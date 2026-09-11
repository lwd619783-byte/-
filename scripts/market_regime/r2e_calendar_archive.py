"""Follow saved SSE pagination metadata, without guessing historical URLs."""
import re
from .r2e_calendar import *


def run():
    parent = strict_json((ROOT / FOLDER / 'archive-retrieval.v1.json').read_bytes())['attempts'][0]
    body = (ROOT / parent['storedBytes']['localPath']).read_bytes().decode('utf-8')
    path = re.search(r'id="pageParam" data="[^"]+" url="([^"]+)"', body)[1]
    url = urljoin(parent['requestedUrl'], path)
    row = capture('SSE', url, dict(kind='SAVED_SCRIPT_URL_ATTRIBUTE', parent=parent['requestedUrl'], text=path))
    # data-main is a literal RequireJS module path in the same retained page.
    module = re.search(r'data-main="([^"]+)"', body)[1]
    runtime = capture('SSE', urljoin(parent['requestedUrl'], module + '.js'),
                      dict(kind='REQUIREJS_DATA_MAIN', parent=parent['requestedUrl'], text=module))
    write_new(ROOT / FOLDER / 'archive-navigation.v1.json', seal(dict(kind='R2_E_ARCHIVE_NAVIGATION', version='v1', attempts=[row, runtime])))
    print([(r['httpStatus'], r['storedBytes']) for r in (row, runtime)])


def renderer():
    r = strict_json((ROOT / FOLDER / 'archive-navigation.v1.json').read_bytes())['attempts'][1]
    body = (ROOT / r['storedBytes']['localPath']).read_text(encoding='utf-8')
    modules = re.findall(r'"([^"]*page_list_[^"]*)"', body)
    rows = [capture('SSE', urljoin(r['requestedUrl'], module + '.js'),
                    dict(kind='REQUIREJS_MODULE', parent=r['requestedUrl'], text=module)) for module in modules]
    write_new(ROOT / FOLDER / 'archive-renderer.v1.json', seal(dict(kind='R2_E_ARCHIVE_RENDERER', version='v1', attempts=rows)))


def pages():
    index = strict_json((ROOT / FOLDER / 'archive-retrieval.v1.json').read_bytes())['attempts'][0]
    page = (ROOT / index['storedBytes']['localPath']).read_text(encoding='utf-8')
    count = int(re.search(r"createPageHTML\('paging',(\d+),", page)[1])
    runtime = strict_json((ROOT / FOLDER / 'archive-common.v1.json').read_bytes())['attempts'][0]
    script = (ROOT / runtime['storedBytes']['localPath']).read_text(encoding='utf-8')
    rule = '(page == 1 ? "" : "_" + page)'
    require(rule in script and count == 6, 'PAGINATION_RULE_CHANGED')
    first = strict_json((ROOT / FOLDER / 'archive-navigation.v1.json').read_bytes())['attempts'][0]
    rows = [capture('SSE', first['requestedUrl'].removesuffix('.shtml') + '_' + str(n) + '.shtml',
                    dict(kind='SAVED_PAGINATION_RULE', parent=index['requestedUrl'],
                         script=runtime['requestedUrl'], text=rule, page=n)) for n in range(2, count + 1)]
    write_new(ROOT / FOLDER / 'archive-pages.v1.json', seal(dict(kind='R2_E_ARCHIVE_PAGES', version='v1', attempts=rows)))
    notices = []
    seen = {r['requestedUrl'] for r in strict_json((ROOT / JOURNAL).read_bytes())['attempts']}
    for parent in [first] + rows:
        for url in parent.get('links', []):
            if '/disclosure/announcement/general/c/' in url and url not in seen:
                notices.append(capture('SSE', url, dict(kind='SAVED_PARENT_LINK', parent=parent['requestedUrl'])))
                seen.add(url)
    write_new(ROOT / FOLDER / 'archive-notices.v1.json', seal(dict(kind='R2_E_ARCHIVE_NOTICES', version='v1', attempts=notices)))
    print(dict(pages=count, notices=len(notices)))


if __name__ == '__main__':
    import sys
    pages() if '--pages' in sys.argv else renderer() if '--renderer' in sys.argv else run()
