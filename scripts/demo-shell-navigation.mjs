// Operate the same visible drawer controls available to users.
export async function navigateDemo(page, label, group) {
  const toggle = page.locator('.demo-sidebar-toggle');
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  if (group) {
    const section = page.locator('.demo-group-toggle').filter({ hasText: group });
    if (await section.getAttribute('aria-expanded') === 'false') await section.click();
  }
  await page.locator('.demo-nav-item').filter({ hasText: label }).click();
}
