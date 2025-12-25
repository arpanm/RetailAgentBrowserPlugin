#!/bin/bash

# RetailAgent Central Build Wrapper (mvnw)
# This script provides a unified interface for build, test, and quality tasks.

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_usage() {
    echo -e "${BLUE}RetailAgent Build Wrapper${NC}"
    echo "Usage: ./mvnw <command>"
    echo ""
    echo "Build Commands:"
    echo "  build:local      Perform a local/development build using Webpack"
    echo "  build:prod       Perform a production-ready build for the Chrome Web Store"
    echo "  clean            Remove build artifacts (dist directory)"
    echo "  install          Install project dependencies"
    echo ""
    echo "Testing Commands:"
    echo "  test:unit        Run unit tests using Vitest"
    echo "  test:int         Run integration/E2E tests using Playwright"
    echo "  test:all         Run both unit and integration tests"
    echo ""
    echo "Quality & Security Commands:"
    echo "  quality          Run linting and formatting checks"
    echo "  security         Run npm audit for security vulnerabilities"
    echo "  validate         Full project validation (quality + unit tests)"
    echo ""
    echo "Other:"
    echo "  help             Show this help message"
}

case "$1" in
    "install")
        echo -e "${BLUE}Installing dependencies...${NC}"
        npm install
        echo -e "${GREEN}Dependencies installed successfully.${NC}"
        ;;
    "build:local")
        echo -e "${BLUE}Starting local/development build...${NC}"
        npm run build:dev
        echo -e "${GREEN}Local build completed.${NC}"
        ;;
    "build:prod")
        echo -e "${BLUE}Starting production build...${NC}"
        npm run build
        echo -e "${GREEN}Production build completed. Ready for publishing.${NC}"
        ;;
    "clean")
        echo -e "${BLUE}Cleaning build artifacts...${NC}"
        rm -rf dist
        echo -e "${GREEN}Cleaned successfully.${NC}"
        ;;
    "test:unit")
        echo -e "${BLUE}Running unit tests...${NC}"
        npm run test
        ;;
    "test:int")
        echo -e "${BLUE}Running integration/E2E tests...${NC}"
        npm run test:e2e
        ;;
    "test:all")
        echo -e "${BLUE}Running all tests...${NC}"
        npm run test:all
        ;;
    "quality")
        echo -e "${BLUE}Running code quality checks (Lint + Format)...${NC}"
        npm run lint
        npm run format:check
        echo -e "${GREEN}Quality checks passed.${NC}"
        ;;
    "security")
        echo -e "${BLUE}Running security audit...${NC}"
        npm run security
        ;;
    "validate")
        echo -e "${BLUE}Running full validation...${NC}"
        npm run validate
        echo -e "${GREEN}Full validation passed.${NC}"
        ;;
    "help" | "")
        print_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        print_usage
        exit 1
        ;;
esac

