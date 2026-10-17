import { navigateDemo } from './demo-shell-navigation.mjs';
// Synthetic UI inputs only. The browser harness aborts every attempted outbound
// navigation, including popup requests; reproduction never contacts a real site.
export async function exerciseDemoResearchLinks(page, screenshot) {
  const origin = new URL(page.url()).origin;
  const links = [];
  const openThesis = () => navigateDemo(page, 'Thesis 演练', '历史复盘');
  const probe = async (name, label) => {
    const link = page.getByRole('link', { name }).first();
    const before = page.url();
    const attributes = await link.evaluate(element => ({ tag: element.tagName,
      href: element.getAttribute('href'), target: element.getAttribute('target'), disabled: element.getAttribute('aria-disabled') }));
    // Force bypasses Playwright actionability for aria-disabled text so native
    // mouse defaults are still tested; it does not inject a click handler.
    await link.click({ force: true });
    await link.click({ modifiers: ['Control'], force: true });
    await link.click({ button: 'middle', force: true });
    await link.focus(); await page.keyboard.press('Enter');
    // Let popup/navigation events settle before reading the context-wide report.
    await page.waitForTimeout(150);
    links.push({ surface: label, ...attributes, samePage: before === page.url() });
    await screenshot(label);
  };
  await page.goto(origin);
  await openThesis();
  await page.getByRole('button', { name: '修订为新草稿', exact: true }).click();
  await page.getByLabel('Thesis 背景标题', { exact: true }).fill('Synthetic Thesis Context');
  await page.getByLabel('Thesis 背景链接', { exact: true }).fill('https://example.invalid/synthetic-thesis');
  await page.getByRole('button', { name: '添加研究背景', exact: true }).click();
  await page.getByLabel('Thesis 修订说明', { exact: true }).fill('Synthetic outbound navigation regression');
  await page.getByRole('button', { name: '保存 Thesis 草稿', exact: true }).click();
  await probe(/^Synthetic Thesis Context/, 'Thesis-context-policy');

  await page.reload();
  await openThesis();
  await page.getByRole('button', { name: /^Claim → Evidence/ }).first().click();
  await page.getByRole('button', { name: '管理 Claim 当前状态与全部历史（独立于此引用）', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '主张验证与历史', exact: true });
  await dialog.getByLabel('背景标题', { exact: true }).fill('Synthetic Claim Context');
  await dialog.getByLabel('背景链接', { exact: true }).fill('https://example.invalid/synthetic-claim');
  await dialog.getByLabel('修订或审核说明', { exact: true }).fill('Synthetic popup navigation regression');
  await dialog.getByRole('button', { name: '保存新草稿版本', exact: true }).click();
  await probe(/^Synthetic Claim Context/, 'Claim-context-policy');
  return links;
}
