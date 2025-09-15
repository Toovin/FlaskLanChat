#!/bin/bash

echo "========================================"
echo "FlaskLanChat SSL Certificate Generator"
echo "========================================"
echo
echo "This script will generate self-signed SSL certificates"
echo "for FlaskLanChat HTTPS server."
echo
echo "You will need to update the IP addresses in the script"
echo "to match your network configuration."
echo

# Get server IP addresses from user input
read -p "Enter your primary server IP address: " SERVER_IP1
if [ -z "$SERVER_IP1" ]; then
    echo "ERROR: Primary server IP is required."
    exit 1
fi

read -p "Enter secondary server IP (or press Enter to skip): " SERVER_IP2
read -p "Enter tertiary server IP (or press Enter to skip): " SERVER_IP3

echo
echo "Using IP addresses:"
echo "- $SERVER_IP1"
[ -n "$SERVER_IP2" ] && echo "- $SERVER_IP2"
[ -n "$SERVER_IP3" ] && echo "- $SERVER_IP3"
echo

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    echo "ERROR: OpenSSL is not installed or not in PATH."
    echo "Please install OpenSSL and try again."
    echo
    echo "On Ubuntu/Debian: sudo apt-get install openssl"
    echo "On macOS: brew install openssl"
    echo "On CentOS/RHEL: sudo yum install openssl"
    exit 1
fi

echo "Generating SSL certificates..."
echo

# Build subjectAltName extension
ALT_NAMES="IP:$SERVER_IP1"
[ -n "$SERVER_IP2" ] && ALT_NAMES="$ALT_NAMES,IP:$SERVER_IP2"
[ -n "$SERVER_IP3" ] && ALT_NAMES="$ALT_NAMES,IP:$SERVER_IP3"

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=CA/L=Network/O=FlaskLanChat/CN=$SERVER_IP1" -addext "subjectAltName=$ALT_NAMES"

if [ $? -eq 0 ]; then
    echo
    echo "========================================"
    echo "SUCCESS: SSL certificates generated!"
    echo "========================================"
    echo
    echo "Certificate files created:"
    echo "- cert.pem (SSL certificate)"
    echo "- key.pem (private key)"
    echo
    echo "Valid for IP addresses:"
    echo "- $SERVER_IP1"
    [ -n "$SERVER_IP2" ] && echo "- $SERVER_IP2"
    [ -n "$SERVER_IP3" ] && echo "- $SERVER_IP3"
    echo
    echo "Expires: This certificate is valid for 365 days"
    echo
    echo "You can now run the server with:"
    echo "python server_v5.py"
    echo
else
    echo
    echo "ERROR: Failed to generate certificates."
    echo "Please check the error messages above."
    echo
    exit 1
fi