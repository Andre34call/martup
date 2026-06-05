#!/bin/bash
# Wrapper script for prisma db push
# Workaround for Prisma 6.19.2 WASM .env parser bug
# Reads DATABASE_URL from .env and passes it as inline env var

cd "$(dirname "$0")/.."

# Parse DATABASE_URL from .env (handles URL-encoded chars)
DB_URL=$(python3 -c "
import urllib.parse
with open('.env') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            val = line[len('DATABASE_URL='):].strip().strip('\"').strip(\"'\")
            # Decode URL-encoded characters (e.g. %24 -> $)
            val = urllib.parse.unquote(val)
            print(val)
            break
")

# Also parse SUPABASE_DIRECT_URL for schema migrations
DIRECT_URL=$(python3 -c "
import urllib.parse
with open('.env') as f:
    for line in f:
        if line.startswith('SUPABASE_DIRECT_URL='):
            val = line[len('SUPABASE_DIRECT_URL='):].strip().strip('\"').strip(\"'\")
            val = urllib.parse.unquote(val)
            print(val)
            break
")

# For db push, try direct URL first (avoids PgBouncer prepared statement issues)
# Fall back to pooler URL if direct is unreachable
PUSH_URL="${DIRECT_URL:-$DB_URL}"

echo "🔄 Running prisma db push..."
echo "   Using URL: $(echo $PUSH_URL | sed 's/:[^@]*@/:***@/')"

# Temporarily rename .env so Prisma doesn't try to read it with its buggy WASM parser
mv .env .env.tmp 2>/dev/null || true

# Run prisma db push with inline DATABASE_URL
DATABASE_URL="$PUSH_URL" SUPABASE_DIRECT_URL="$DIRECT_URL" npx prisma db push --accept-data-loss 2>&1
RESULT=$?

# Restore .env
mv .env.tmp .env 2>/dev/null || true

exit $RESULT
