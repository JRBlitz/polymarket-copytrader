#!/bin/bash

echo "🚀 Polymarket Copytrader Pro - Quick Start"
echo "=============================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    echo "   Please upgrade Node.js first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating environment configuration..."
    cp env.example .env
    echo "✅ Environment file created (.env)"
    echo "   Please edit .env with your Polymarket API credentials"
    echo ""
fi

# Build backend
echo "🔨 Building backend..."
npm run build:backend

if [ $? -ne 0 ]; then
    echo "❌ Failed to build backend"
    exit 1
fi

echo "✅ Backend built successfully"
echo ""

# Run tests
echo "🧪 Running system tests..."
npx ts-node src/backend/test.ts

if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "🚀 To start the system:"
echo "   1. Edit .env with your API credentials"
echo "   2. Start backend: npm run dev:backend"
echo "   3. Start frontend: npm run dev"
echo "   4. Open http://localhost:5173 in your browser"
echo ""
echo "🐳 Or use Docker:"
echo "   docker-compose up -d"
echo ""
echo "📚 For more information, see README.md"
echo ""
echo "Happy trading! 🎯"
