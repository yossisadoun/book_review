#!/bin/bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
cd /Users/yossi/Cursor/book_review
npm run dev
