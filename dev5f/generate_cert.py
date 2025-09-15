#!/usr/bin/env python3
"""
Simple SSL certificate generator for FlaskLanChat
Creates a basic self-signed certificate for development use
"""

import ssl
import os
from datetime import datetime, timedelta

def generate_selfsigned_cert():
    """Generate a self-signed certificate for the network interfaces"""

    print("🔐 FlaskLanChat SSL Certificate Generator")
    print("=" * 50)
    print()
    print("This will generate self-signed SSL certificates for HTTPS.")
    print("You'll need to provide your server's IP addresses.")
    print()

    # Get server IP addresses from user
    server_ip1 = input("Enter your primary server IP address: ").strip()
    if not server_ip1:
        print("❌ Primary server IP is required.")
        return False

    server_ip2 = input("Enter secondary server IP (or press Enter to skip): ").strip()
    server_ip3 = input("Enter tertiary server IP (or press Enter to skip): ").strip()

    # Create certificate info
    cert_info = {
        'country_name': 'US',
        'state_or_province_name': 'CA',
        'locality_name': 'Network',
        'organization_name': 'FlaskLanChat',
        'common_name': server_ip1,
        'valid_days': 365
    }

    # Build subjectAltName extension
    alt_names = f"IP:{server_ip1}"
    if server_ip2:
        alt_names += f",IP:{server_ip2}"
    if server_ip3:
        alt_names += f",IP:{server_ip3}"

    # Create a basic certificate using OpenSSL command line
    openssl_cmd = f"""
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days {cert_info['valid_days']} -nodes -subj "/C={cert_info['country_name']}/ST={cert_info['state_or_province_name']}/L={cert_info['locality_name']}/O={cert_info['organization_name']}/CN={cert_info['common_name']}" -addext "subjectAltName={alt_names}"
"""

    try:
        # Try to run openssl command
        import subprocess
        result = subprocess.run(openssl_cmd.strip(), shell=True, capture_output=True, text=True)

        if result.returncode == 0:
            print("✅ SSL certificates generated successfully!")
            print("Certificate: cert.pem")
            print("Private Key: key.pem")
            print(f"Valid for IPs: {server_ip1}", end="")
            if server_ip2:
                print(f", {server_ip2}", end="")
            if server_ip3:
                print(f", {server_ip3}", end="")
            print()
            print(f"Expires: {datetime.now() + timedelta(days=cert_info['valid_days'])}")
            return True
        else:
            print("❌ OpenSSL command failed:")
            print(result.stderr)
            return False

    except Exception as e:
        print(f"❌ Failed to generate certificates: {e}")
        print("Please ensure OpenSSL is installed on your system.")
        return False

if __name__ == "__main__":
    success = generate_selfsigned_cert()
    if success:
        print("\n🎉 Ready for HTTPS! Run your server with:")
        print("python server_v5.py")
    else:
        print("\n❌ Certificate generation failed.")
        print("Make sure OpenSSL is installed and available in your PATH.")

if __name__ == "__main__":
    generate_selfsigned_cert()