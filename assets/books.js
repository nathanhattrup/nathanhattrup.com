// Bookshelf data for books.html.
//
// To add a book:
//   1. Get a cover jpg into images/books/<slug>.jpg
//      Easiest: run  python3 get_cover.py "Title" "Author" slug
//      (pulls from Open Library; if it misses, save any jpg there yourself)
//   2. Append an entry below. Fields:
//      slug   - cover filename without .jpg
//      title  - shown everywhere
//      author - shown everywhere
//      read   - internal only, never displayed. "YYYY" or "YYYY-MM".
//               Rough is fine; "2023" = the pre-2024 pile.
//      format - "audio" for audiobooks, omit for print
//      fav    - true puts the book in the Favorites section at the top
//               of the page (alphabetical, cover + title/author shown)
//      sortTitle / sortAuthor - optional overrides for sorting, only
//               needed when the default (title minus leading "The/A/An",
//               author's last word) gets it wrong.
const BOOKS = [
  // --- Before 2024 (rough pile, order not meaningful) ---
  { slug: "common-sense",        title: "Common Sense",           author: "Thomas Paine",        read: "2019", fav: true },
  { slug: "think-and-grow-rich", title: "Think and Grow Rich",    author: "Napoleon Hill",       read: "2020" },
  { slug: "the-art-of-war",      title: "The Art of War",         author: "Sun Tzu",             read: "2020", sortAuthor: "Sun" },
  { slug: "rich-dad-poor-dad",   title: "Rich Dad Poor Dad",      author: "Robert Kiyosaki",     read: "2019" },
  { slug: "1984",                title: "1984",                   author: "George Orwell",       read: "2023" },
  { slug: "fahrenheit-451",      title: "Fahrenheit 451",         author: "Ray Bradbury",        read: "2022" },
  { slug: "lord-of-the-flies",   title: "Lord of the Flies",      author: "William Golding",     read: "2022" },
  { slug: "huckleberry-finn",    title: "The Adventures of Huckleberry Finn", author: "Mark Twain", read: "2023" },
  { slug: "the-great-gatsby",    title: "The Great Gatsby",       author: "F. Scott Fitzgerald", read: "2023" },
  { slug: "frankenstein",        title: "Frankenstein",           author: "Mary Shelley",        read: "2023" },
  { slug: "enemy-at-the-gates",  title: "Enemy at the Gates",     author: "William Craig",       read: "2019", fav: true },

  // --- 2024 ---
  { slug: "book-of-methods",     title: "The Book of Methods",    author: "Louie Simmons",       read: "2024-01" },
  { slug: "republic-of-pirates", title: "The Republic of Pirates", author: "Colin Woodard",      read: "2024-05", format: "audio", fav: true },
  { slug: "the-war-of-art",      title: "The War of Art",         author: "Steven Pressfield",   read: "2024-03", format: "audio" },
  { slug: "body-recomposition",  title: "The Ultimate Guide to Body Recomposition", author: "Jeff Nippard", read: "2024-04" },
  { slug: "catcher-in-the-rye",  title: "The Catcher in the Rye", author: "J.D. Salinger",       read: "2024-02" },

  // --- 2025 ---
  { slug: "mother-of-god",       title: "Mother of God",          author: "Paul Rosolie",        read: "2025-02" },
  { slug: "catch-22",            title: "Catch-22",               author: "Joseph Heller",       read: "2025-01" },
  { slug: "ruthless-elimination-of-hurry", title: "The Ruthless Elimination of Hurry", author: "John Comer", read: "2025-04" },
  { slug: "the-lean-startup",    title: "The Lean Startup",       author: "Eric Ries",           read: "2025-03", format: "audio" },

  // --- 2026 ---
  { slug: "river-of-darkness",   title: "River of Darkness",      author: "Buddy Levy",          read: "2026-02", fav: true },
  { slug: "robinson-crusoe",     title: "Robinson Crusoe",        author: "Daniel Defoe",        read: "2026-03", format: "audio" },
  { slug: "the-great-heist",     title: "The Great Heist",        author: "Andrew Badger and David Shedd", read: "2026-04", sortAuthor: "Badger" },
  // First read 2024, re-read June 2026 - sorts by the latest read
  { slug: "cant-hurt-me",        title: "Can't Hurt Me",          author: "David Goggins",       read: "2026-05", format: "audio" },
  { slug: "the-big-leap",        title: "The Big Leap",           author: "Gay Hendricks",       read: "2026-06-01", format: "audio" },
  { slug: "junglekeeper",        title: "Junglekeeper",           author: "Paul Rosolie",        read: "2026-06-02", fav: true },
  { slug: "zero-to-one",         title: "Zero to One",            author: "Peter Thiel",         read: "2026-06-03", format: "audio" },
];
