from OpenSSL import crypto
import os

def generate_selfsigned_cert():
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, 4096)
    cert = crypto.X509()
    cert.get_subject().CN = "192.168.1.101"  # your IP goes here
    cert.set_serial_number(1000)
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(365 * 24 * 60 * 60)  # 1 year
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(k)
    cert.sign(k, 'sha256')
    with open("cert.pem", "wt") as f:
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert).decode())
    with open("key.pem", "wt") as f:
        f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, k).decode())

if __name__ == "__main__":
    generate_selfsigned_cert()