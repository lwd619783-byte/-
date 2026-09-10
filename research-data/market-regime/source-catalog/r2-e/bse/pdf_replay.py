"""Offline PDF text evidence replay; no layout or formal numeric extraction claim."""
import hashlib
import json
import sys
from io import BytesIO
from pypdf import PdfReader
from probe import HERE, replay


def derive():
    docs=[]
    for capture in replay():
        name=capture['request']['requestId']
        if not name.startswith('annual-pdf-'):
            continue
        b=(HERE/capture['bodyPath']).read_bytes()
        reader=PdfReader(BytesIO(b))
        pages=[]
        for i,page in enumerate(reader.pages):
            text=page.extract_text()
            matches=[]
            for term in ['精选层','追溯调整']:
                start=text.find(term)
                if start>=0:
                    matches.append(dict(term=term,text=text[max(0,start-65):start+160]))
            if matches:
                pages.append(dict(pageNumber=i+1,extractedPageText=text,
                    extractedTextSha256=hashlib.sha256(text.encode()).hexdigest(),findings=matches))
        docs.append(dict(requestId=name,rawSha256=capture['sha256'],pageCount=len(reader.pages),pages=pages))
    return dict(kind='PDF_TEXT_AUDIT_NOT_R2_FIELD_EXTRACTION',documents=docs,
        limitations=['No visual layout validation claimed.','PDF text snippets are not literal original-byte locators.','Annual/monthly statistics cannot be split into daily observations.',
            '2025 retrospective adjustment wording applies to stock refinancing, not proof that turnover or market capitalization was revised.',
            'File path dates and PDF metadata do not establish first release or historical revision sequence.'])


if __name__=='__main__':
    out=derive();path=HERE/'pdf-audit.v1.json'
    if sys.argv[1:]==['build']:
        if path.exists():assert json.loads(path.read_text(encoding='utf-8'))==out
        else:path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    elif sys.argv[1:]==['validate']:
        assert json.loads(path.read_text(encoding='utf-8'))==out
    else:raise SystemExit('usage: pdf_replay.py build|validate')
    print(json.dumps(dict(status='PASS',pdfCount=len(out['documents']))))
