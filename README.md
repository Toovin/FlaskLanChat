# FlaskLanChat - a mostly (Maybe -- im working on redoing this boilerplate) working lan chat with an extreme lack of secure features and operations. DONT USE IN SENSITIVE ENVIRONMENTS WITH OUT IMPLEMENTING HTTPS/CERTS. 
FlaskLanChat - Send/receive  group messages, share files, and some other extra AI goodies with some elbow grease. 


PYTHON 3.13.5 ENVIRONEMNT
VOICE CHAT: SEPARATE LIVEKIT SERVER PROCESS, SEE BELOW. 

INSTALL DEPENDENCIES (Example list given from working environment, probably dont need all of them but just in case...)
## TO RUN : server_v5.py launches server on port 6970 with a devchat.db for chat history. 
## TO ACCESS : on client machine (even host machine!) enter the ip address of the server (typically http://192.168.x.x:6970) from the same network and a login/create account screen appears. Be mindful on the account creation - there is no verify password. If you goof your desired username, you have to delete the devchat.db and start over for now (its on a todo list, hold on!)
##########

* I WILL NOT BE OFFERING ASSISTANCE ON THIS, THIS IS A HOBBY PROJECT, IF YOU WANT IT, CLONE IT, MODIFY IT - ITS YOURS. VIBE CODE MODIFY WITH AI IF YOU NEED TO!
* NO HTTPS YET * : Until more core functions in place. Security was not a concern for this use case, and this project **should not** be used in an environment where secure access would be advisable.  
* This project is provided AS-IS, whatever you do with this 'boiler-plate' is up to you, its simply a working (on my end!) amalgamation of python/flask (html/js with socket 4.8.1).  
* Extra features like image generation (sd_integration.py) relies on an external (LAN!) openAPI endpoint (built and tested with forgeUI), functional if configured. 
* chicken_pic.py extension calls out to a mediamtx service on a raspberry pi - flexible setup, functional if configured. Originally for chicken coop, but, do what you will for camera image on demand. 
* eai_integration is a boilerplate extension for AI integration (conversation / vision chat LLM) - needs work, not currently functional. 
* fun_commands.py extension was testing stuff, placeholders for what you might wanna adjust. 
* user_profile.py extension, not functional, planned to add bio and some background info primarily for bot/ai interaction/personalization. 
##########


chat server python 3.13.5, windows 10 environment

## Project Dependencies

```plaintext
aiofiles              24.1.0
aiohappyeyeballs      2.6.1
aiohttp               3.12.15
aiosignal             1.4.0
attrs                 25.3.0
bidict                0.23.1
blinker               1.9.0
certifi               2025.8.3
cffi                  2.0.0
charset-normalizer    3.4.3
click                 8.2.1
colorama              0.4.6
cryptography          45.0.7
Flask                 3.1.2
Flask-SocketIO        5.5.1
frozenlist            1.7.0
h11                   0.16.0
idna                  3.10
itsdangerous          2.2.0
Jinja2                3.1.6
livekit               1.0.12
livekit-api           1.0.5
livekit-protocol      1.0.5
livekit-tools         0.0.0.dev2
markdown-it-py        4.0.0
MarkupSafe            3.0.2
mdurl                 0.1.2
multidict             6.6.4
numpy                 2.2.6
opencv-python         4.12.0.88
pillow                11.3.0
pip                   25.2
propcache             0.3.2
protobuf              6.32.0
pycparser             2.22
Pygments              2.19.2
PyJWT                 2.10.1
pyOpenSSL             25.1.0
python-engineio       4.12.2
python-socketio       5.13.0
pytimeparse2          1.7.1
requests              2.32.5
rich                  14.1.0
shellingham           1.5.4
simple-websocket      1.1.0
typer                 0.17.4
types-protobuf        6.30.2.20250822
typing_extensions     4.15.0
urllib3               2.5.0
Werkzeug              3.1.3
wsproto               1.2.0
yarl                  1.20.1

LiveKit 1.9.1 -- kicked off from exe directory with: 
/dir_with_livekit/livekit-server.exe --dev --bind 0.0.0.0
```
https://github.com/livekit/livekit/releases/tag/v1.9.1

Ensure you point the server at the host machine running livekit. 
Configure endpoint in lc_config.py (LIVEKIT_WS_URL= 'ws://ip-address-go-here:port-number-too' such as 'ws://192.168.1.101:7880'

Again, hobbyist here and mostly vibe coded this as I learn more - don't use this in any production environment with out first checking over EVERYTHING to ensure its to your liking and approval, and particularly with HTTPS/CERTS. 

I'll get around to securing it properly eventually -- for now, fun experimentation and education (with a functional creation!)

##########
NOTE ON LIVEKIT AUDIO!!!
* Most browsers wont even entertain a cross origin HTTP request for microphone/webcam access. In Brave Browser i had to implement the following change: *
brave://flags/#unsafely-treat-insecure-origin-as-secure
ENABLE Insecure-origins-treated-as-secure
then enter the http://IP-ADDRESS:PORT of the livekit instance. 
THE BROWSER SHOULD THEN ALLOW THE MICROPHONE/WEBCAM ACCESS PROMPT.
This change ONLY effects the given entered website - all other websites will fallback to a secure pipeline. 
##########



MIT License

Copyright (c) 2025 Toovin Extreme (@toovin)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
