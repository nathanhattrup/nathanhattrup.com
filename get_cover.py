#!/usr/bin/env python3
"""Download a book cover from Open Library into images/books/.

Usage:
    python3 get_cover.py "Title" "Author" [slug]

The slug becomes the filename (images/books/<slug>.jpg) and should match
the `slug` field of the book's entry in assets/books.js. If omitted, it's
generated from the title (lowercase, dashes).

If Open Library has no cover for the book, this prints the search results
it found so you can judge, and you'll need to source a jpg yourself (just
drop any cover image at images/books/<slug>.jpg).
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "images", "books")
UA = {"User-Agent": "nathanhattrup.com bookshelf (nahattrup@gmail.com)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=30).read()


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    title, author = sys.argv[1], sys.argv[2]
    slug = sys.argv[3] if len(sys.argv) > 3 else re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    dest = os.path.join(OUT_DIR, slug + ".jpg")
    if os.path.exists(dest):
        print(f"{dest} already exists - delete it first if you want to refetch")
        sys.exit(1)

    q = urllib.parse.urlencode({"title": title, "author": author, "limit": 10})
    docs = json.loads(get(f"https://openlibrary.org/search.json?{q}")).get("docs", [])
    if not docs:
        print("No search results at all - check spelling.")
        sys.exit(1)

    # Take the first result that actually has a cover scan
    for doc in docs:
        cover_id = doc.get("cover_i")
        if not cover_id:
            continue
        img = get(f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg")
        if len(img) < 2000:  # Open Library serves a tiny placeholder when missing
            continue
        with open(dest, "wb") as f:
            f.write(img)
        print(f"Saved {dest} ({len(img)//1024} KB)")
        print(f"Matched: {doc.get('title')} by {', '.join(doc.get('author_name', ['?']))}")
        print(f"\nNow add to assets/books.js:")
        print(f'  {{ slug: "{slug}", title: "{title}", author: "{author}", read: "YYYY-MM" }},')
        return

    print("Results found, but none with a usable cover:")
    for doc in docs[:5]:
        print(f"  - {doc.get('title')} by {', '.join(doc.get('author_name', ['?']))}")
    print(f"\nSource a jpg manually and save it as {dest}")
    sys.exit(1)


if __name__ == "__main__":
    main()
