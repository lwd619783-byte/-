import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Read syntax only. Never evaluate imports, constructors, functions or object spreads. */
export function parsePrivateCompanyIds(source) {
  const file = ts.createSourceFile('privateCompanies.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error('PRIVATE_SOURCE_PARSE_FAILED');
  if (file.statements.some(statement => !(ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)
    || (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly)
    || (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)
      && statement.declarationList.declarations.length === 1
      && ts.isIdentifier(statement.declarationList.declarations[0].name)
      && statement.declarationList.declarations[0].name.text === 'roboticsPrivateCompanies')))) {
    throw new Error('PRIVATE_SOURCE_UNSUPPORTED_STATEMENT');
  }
  const declarations = file.statements.filter(statement => ts.isVariableStatement(statement)
    && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap(statement => [...statement.declarationList.declarations])
    .filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'roboticsPrivateCompanies');
  if (declarations.length !== 1) throw new Error('PRIVATE_EXPORT_REQUIRED');
  const initializer = declarations[0].initializer;
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) throw new Error('PRIVATE_LITERAL_ARRAY_REQUIRED');
  const ids = initializer.elements.map(element => {
    if (!ts.isObjectLiteralExpression(element) || element.properties.some(ts.isSpreadAssignment)) throw new Error('PRIVATE_LITERAL_OBJECT_REQUIRED');
    const identityProperties = element.properties.filter(property => property.name
      && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'id');
    if (element.properties.some(property => property.name && ts.isComputedPropertyName(property.name))
      || identityProperties.length !== 1 || !ts.isPropertyAssignment(identityProperties[0])
      || !ts.isStringLiteral(identityProperties[0].initializer)) throw new Error('PRIVATE_LITERAL_ID_REQUIRED');
    const id = identityProperties[0].initializer.text;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('PRIVATE_ID_FORMAT_INVALID');
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new Error('PRIVATE_DUPLICATE_ID');
  return ids;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const filename = process.argv[2] ?? path.resolve('src/data/privateCompanies.ts');
    console.log(JSON.stringify(parsePrivateCompanyIds(fs.readFileSync(filename, 'utf8'))));
  } catch {
    console.error('CURRENT_PRIVATE_SOURCE_UNAVAILABLE');
    process.exitCode = 1;
  }
}
