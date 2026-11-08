import argparse
from urllib.parse import urlencode
import qrcode

p=argparse.ArgumentParser()
p.add_argument('--base', required=True, help='Example: https://your-domain.com/tv/')
p.add_argument('--mac', default='94:23:87:99:03:15')
p.add_argument('--key', default='862416')
p.add_argument('--out', default='device_qr.png')
a=p.parse_args()
url=a.base.rstrip('/')+'/?'+urlencode({'mac':a.mac,'key':a.key})
qrcode.make(url).save(a.out)
print(url)
