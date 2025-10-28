#!/bin/bash

# Paradigm Dental Platform Startup Script

echo "🏥 Starting Paradigm Dental Platform..."
echo "========================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm install && cd ..
fi

# Check if database is initialized
echo "🗄️  Checking database..."
if ! npm run init-db > /dev/null 2>&1; then
    echo "⚠️  Database initialization failed. Please check your PostgreSQL connection."
    echo "   Make sure PostgreSQL is running and the database 'paradigm_dental' exists."
    exit 1
fi

echo "✅ Database initialized successfully."

# Start the server
echo "🚀 Starting server..."
npm run server &

# Wait a moment for server to start
sleep 3

# Start the client
echo "🌐 Starting client..."
cd client && npm start &

echo ""
echo "🎉 Paradigm Dental Platform is starting up!"
echo ""
echo "📊 Admin Dashboard: http://localhost:3000/admin"
echo "🦷 Dentist Portal: http://localhost:3000/dentist"
echo "🏭 Supplier Portal: http://localhost:3000/supplier"
echo ""
echo "Demo Accounts:"
echo "  Admin: admin@paradigmlab.com / admin123456"
echo "  Dentist: dentist@example.com / password123"
echo "  Supplier: supplier@example.com / password123"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for user to stop
wait