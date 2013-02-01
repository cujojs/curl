import os


def generate():
    location = ''
    try:
        location = os.path.dirname(__file__)
    except:
        location = os.path.abspath('.')

    files = os.listdir(location)
    files.sort()

    links = []
    counter = 0

    for fn in files:
        if fn.endswith('.html') and fn != 'index.html' and os.path.isfile(fn):
            counter += 1
            links.append('<p>%s <a href="%s">%s</a></p>' % (counter, fn, fn))

    index_full_path = os.path.join(location, 'index.html')
    open(
        index_full_path
        , 'w'
    ).write(
        '<!DOCTYPE html><html><head/><body>%s</body></html>' % ''.join(links)
    )

    print('Generated "%s"' % index_full_path)

if __name__ == '__main__':
    generate()
