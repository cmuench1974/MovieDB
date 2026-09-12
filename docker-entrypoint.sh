#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Ensuring admin user exists..."
node prisma/seed.js

echo "Starting MovieDB..."
exec npm start
