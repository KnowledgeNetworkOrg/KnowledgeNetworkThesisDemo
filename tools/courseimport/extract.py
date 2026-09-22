# Step 1 of the course import: turn a folder of course outlines into plain text.
#
#   python tools/courseimport/extract.py <folder-of-outlines> [<output-folder>]
#
# The outlines are PDFs, saved web pages and one Word file. This does nothing
# clever with any of them — it pulls the text out and stops. The reading,
# judgment and structuring all happen in the next step, by hand, into
# courses.json; see README.md for why that split is deliberate rather than lazy.
#
# Writes UTF-8 with LF endings explicitly: on Windows, Python's text mode turns
# every newline into CRLF, and the tools downstream do not all agree about that.
#
# Needs: pip install pypdf openpyxl

import html
import os
import re
import sys
import zipfile


def from_pdf(path):
    from pypdf import PdfReader

    return ''.join((page.extract_text() or '') for page in PdfReader(path).pages)


def from_html(path):
    s = open(path, encoding='utf-8', errors='replace').read()
    s = re.sub(r'(?is)<(script|style).*?</\1>', ' ', s)
    s = re.sub(r'(?i)</(p|div|tr|li|h[1-6]|table)>', '\n', s)
    s = re.sub(r'(?i)</t[dh]>', ' | ', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t\xa0]+', ' ', s)
    return re.sub(r'\n\s*\n+', '\n', s)


def from_docx(path):
    x = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8', 'replace')
    x = re.sub(r'(?i)</w:p>', '\n', x)
    return html.unescape(re.sub(r'<[^>]+>', '', x))


READERS = {'pdf': from_pdf, 'htm': from_html, 'html': from_html, 'docx': from_docx}


def main(src, out):
    os.makedirs(out, exist_ok=True)
    for name in sorted(os.listdir(src)):
        ext = name.lower().rsplit('.', 1)[-1]
        reader = READERS.get(ext)
        if not reader:
            continue
        try:
            text = reader(os.path.join(src, name))
        except Exception as err:  # a file that will not open is reported, not fatal
            print(f'SKIPPED {name}: {err}')
            continue
        stem = re.sub(r'[^A-Za-z0-9]+', '_', name.rsplit('.', 1)[0])
        dest = os.path.join(out, stem + '.txt')
        open(dest, 'w', encoding='utf-8', newline='\n').write(text)
        print(f'{len(text):7d}  {dest}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__ or 'usage: extract.py <folder-of-outlines> [<output-folder>]')
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'courseimport-text')
