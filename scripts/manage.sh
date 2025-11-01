#!/bin/bash

# FireVision IPTV Server Management Script
# Usage: ./scripts/manage.sh [command]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Load .env if exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

print_help() {
    echo "FireVision IPTV Server Management Script"
    echo ""
    echo "Usage: ./scripts/manage.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start           - Start all services"
    echo "  stop            - Stop all services"
    echo "  restart         - Restart all services"
    echo "  build           - build"
    echo "  logs            - View logs (all services)"
    echo "  logs-api        - View API server logs"
    echo "  logs-mongo      - View MongoDB logs"
    echo "  logs-nginx      - View Nginx logs"
    echo "  status          - Check service status"
    echo "  health          - Check server health"
    echo "  backup          - Backup database and APKs"
    echo "  restore [file]  - Restore database from backup"
    echo "  setup           - Initial setup (create directories, .env)"
    echo "  update          - Pull latest code and restart"
    echo "  clean           - Remove all containers and volumes"
    echo "  shell-api       - Open shell in API container"
    echo "  shell-mongo     - Open MongoDB shell"
    echo "  test-api        - Test API endpoints"
    echo "  generate-key    - Generate secure API key"
    echo "  help            - Show this help message"
    echo ""
}

build_services_api() {
    echo -e "${GREEN}Building FireVision IPTV services...${NC}"
    docker-compose up -d --build api
    echo -e "${GREEN}✓ Services built${NC}"
}

start_services() {
    echo -e "${GREEN}Starting FireVision IPTV services...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✓ Services started${NC}"
    echo ""
    echo "Run './scripts/manage.sh status' to check service status"
}

stop_services() {
    echo -e "${YELLOW}Stopping FireVision IPTV services...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ Services stopped${NC}"
}

restart_services() {
    echo -e "${YELLOW}Restarting FireVision IPTV services...${NC}"
    docker-compose restart
    echo -e "${GREEN}✓ Services restarted${NC}"
}

view_logs() {
    docker-compose logs -f
}

view_api_logs() {
    docker-compose logs -f api
}

view_mongo_logs() {
    docker-compose logs -f mongodb
}

view_nginx_logs() {
    docker-compose logs -f nginx
}

check_status() {
    echo -e "${GREEN}Service Status:${NC}"
    docker-compose ps
}

check_health() {
    echo -e "${GREEN}Checking server health...${NC}"

    if command -v curl &> /dev/null; then
        RESPONSE=$(curl -s http://localhost:8009/health || echo "Connection failed")
        echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${RED}curl not found. Please install curl.${NC}"
        exit 1
    fi
}

backup_data() {
    BACKUP_DIR="./backups"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)

    mkdir -p "$BACKUP_DIR"

    echo -e "${GREEN}Backing up database...${NC}"
    docker-compose exec -T mongodb mongodump --db=firevision-iptv --archive > "$BACKUP_DIR/mongodb-$TIMESTAMP.archive"

    echo -e "${GREEN}Backing up APK files...${NC}"
    tar -czf "$BACKUP_DIR/apks-$TIMESTAMP.tar.gz" apks/ 2>/dev/null || echo "No APK files to backup"

    echo -e "${GREEN}✓ Backup completed${NC}"
    echo "  Database: $BACKUP_DIR/mongodb-$TIMESTAMP.archive"
    echo "  APKs: $BACKUP_DIR/apks-$TIMESTAMP.tar.gz"
}

restore_data() {
    if [ -z "$1" ]; then
        echo -e "${RED}Error: Backup file required${NC}"
        echo "Usage: ./scripts/manage.sh restore [backup-file]"
        exit 1
    fi

    if [ ! -f "$1" ]; then
        echo -e "${RED}Error: Backup file not found: $1${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Restoring database from $1...${NC}"
    cat "$1" | docker-compose exec -T mongodb mongorestore --archive
    echo -e "${GREEN}✓ Database restored${NC}"
}

initial_setup() {
    echo -e "${GREEN}Setting up FireVision IPTV Server...${NC}"

    # Create directories
    mkdir -p apks uploads logs

    # Create .env if doesn't exist
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Creating .env file...${NC}"
        cp .env.example .env

        # Generate API key
        if command -v openssl &> /dev/null; then
            API_KEY=$(openssl rand -hex 32)
            sed -i.bak "s/your-secure-api-key-change-this-immediately/$API_KEY/" .env
            rm .env.bak 2>/dev/null || true
            echo -e "${GREEN}✓ Generated API key: $API_KEY${NC}"
            echo -e "${YELLOW}  Save this key! You'll need it for admin operations.${NC}"
        else
            echo -e "${YELLOW}  Warning: OpenSSL not found. Please manually set API_KEY in .env${NC}"
        fi
    else
        echo -e "${YELLOW}.env file already exists. Skipping...${NC}"
    fi

    echo -e "${GREEN}✓ Setup completed${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review .env file and adjust settings if needed"
    echo "  2. Run './scripts/manage.sh start' to start services"
    echo "  3. Run './scripts/manage.sh test-api' to verify installation"
}

update_server() {
    echo -e "${GREEN}Updating server...${NC}"

    # Pull latest code (if using git)
    if [ -d .git ]; then
        git pull
    fi

    # Rebuild and restart
    docker-compose build
    docker-compose up -d

    echo -e "${GREEN}✓ Server updated${NC}"
}

clean_all() {
    echo -e "${RED}WARNING: This will remove all containers, volumes, and data!${NC}"
    read -p "Are you sure? (yes/no): " CONFIRM

    if [ "$CONFIRM" = "yes" ]; then
        echo -e "${YELLOW}Cleaning up...${NC}"
        docker-compose down -v
        echo -e "${GREEN}✓ Cleanup completed${NC}"
    else
        echo "Cancelled"
    fi
}

shell_api() {
    docker-compose exec api sh
}

shell_mongo() {
    docker-compose exec mongodb mongosh firevision-iptv
}

test_api() {
    echo -e "${GREEN}Testing API endpoints...${NC}"
    echo ""

    # Test health
    echo -e "${YELLOW}1. Health check:${NC}"
    curl -s http://localhost:8009/health | jq . || echo "Failed"
    echo ""

    # Test channels
    echo -e "${YELLOW}2. Get channels:${NC}"
    curl -s http://localhost:8009/api/v1/channels | jq '.count' || echo "Failed"
    echo ""

    # Test version check
    echo -e "${YELLOW}3. Check version:${NC}"
    curl -s "http://localhost:8009/api/v1/app/version?currentVersion=0" | jq '.updateAvailable' || echo "Failed"
    echo ""

    echo -e "${GREEN}✓ Tests completed${NC}"
}

generate_key() {
    if command -v openssl &> /dev/null; then
        KEY=$(openssl rand -hex 32)
        echo -e "${GREEN}Generated API Key:${NC}"
        echo "$KEY"
        echo ""
        echo "Add this to your .env file:"
        echo "API_KEY=$KEY"
    else
        echo -e "${RED}OpenSSL not found. Please install OpenSSL.${NC}"
        exit 1
    fi
}

# Main script logic
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_services_api
        ;;
    logs)
        view_logs
        ;;
    logs-api)
        view_api_logs
        ;;
    logs-mongo)
        view_mongo_logs
        ;;
    logs-nginx)
        view_nginx_logs
        ;;
    status)
        check_status
        ;;
    health)
        check_health
        ;;
    backup)
        backup_data
        ;;
    restore)
        restore_data "$2"
        ;;
    setup)
        initial_setup
        ;;
    update)
        update_server
        ;;
    clean)
        clean_all
        ;;
    shell-api)
        shell_api
        ;;
    shell-mongo)
        shell_mongo
        ;;
    test-api)
        test_api
        ;;
    generate-key)
        generate_key
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        print_help
        exit 1
        ;;
esac
