[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?business=VWW3BHW4AWHUY&item_name=Desenvolvimento+de+Software&currency_code=BRL)
[![FOSSA Status](https://app.fossa.com/api/projects/custom%2B21084%2Fgithub.com%2Fcanove%2Fwhaticket.svg?type=shield)](https://app.fossa.com/projects/custom%2B21084%2Fgithub.com%2Fcanove%2Fwhaticket?ref=badge_shield)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=canove_whaticket&metric=alert_status)](https://sonarcloud.io/dashboard?id=canove_whaticket)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=canove_whaticket&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=canove_whaticket)
[![Discord Chat](https://img.shields.io/discord/784109818247774249.svg?logo=discord)](https://discord.gg/Dp2tTZRYHg)
[![Forum](https://img.shields.io/badge/forum-online-blue.svg?logo=discourse)](https://whaticket.online/)

# WhaTicket!

**NOTE**: The new version of whatsapp-web.js required Node 14. Upgrade your installations to keep using it.

A _very simple_ Ticket System based on WhatsApp messages.

Backend uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) to receive and send WhatsApp messages, create tickets from them and store them in a database managed by **Prisma ORM**. By default, it uses **SQLite** for development.

Frontend is a full-featured multi-user _chat app_ bootstrapped with react-create-app and Material UI, that comunicates with backend using REST API and Websockets. It allows you to interact with contacts, tickets, send and receive WhatsApp messages.

**NOTE**: I can't guarantee you will not be blocked by using this method, although it has worked for me. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## How it works?

On every new message received in an associated WhatsApp, a new Ticket is created. Then, this ticket can be reached in a _queue_ on _Tickets_ page, where you can assign ticket to your yourself by _aceppting_ it, respond ticket message and eventually _resolve_ it.

Subsequent messages from same contact will be related to first **open/pending** ticket found.

If a contact sent a new message in less than 2 hours interval, and there is no ticket from this contact with **pending/open** status, the newest **closed** ticket will be reopen, instead of creating a new one.

## Screenshots

![](https://github.com/canove/whaticket/raw/master/images/whaticket-queues.gif)
<img src="https://raw.githubusercontent.com/canove/whaticket/master/images/chat2.png" width="350"> <img src="https://raw.githubusercontent.com/canove/whaticket/master/images/chat3.png" width="350"> <img src="https://raw.githubusercontent.com/canove/whaticket/master/images/multiple-whatsapps2.png" width="350"> <img src="https://raw.githubusercontent.com/canove/whaticket/master/images/contacts1.png" width="350">

## Features

- Have multiple users chating in same WhatsApp Number ✅
- Connect to multiple WhatsApp accounts and receive all messages in one place ✅ 🆕
- Create and chat with new contacts without touching cellphone ✅
- Send and receive message ✅
- Send media (images/audio/documents) ✅
- Receive media (images/audio/video/documents) ✅

## Installation and Usage (Linux Ubuntu - Development)

The backend now uses Prisma ORM and defaults to a SQLite database for development, located at `backend/dev.db`.
This file will be created automatically when you run the first migration.

**Optional: Using MySQL/MariaDB with Docker (for production-like setup or if preferred over SQLite)**

If you prefer to use MySQL/MariaDB for development:
1.  Update `backend/prisma/schema.prisma`:
    Change `provider = "sqlite"` to `provider = "mysql"`.
2.  Update `backend/.env`:
    Set `DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"` (e.g., `DATABASE_URL="mysql://whaticket:whaticket@localhost:3306/whaticket"`).
3.  You can then use Docker to run MySQL/MariaDB:
    _Note_: Change MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_USER, and MYSQL_ROOT_PASSWORD as needed.
    ```bash
    docker run --name whaticketdb -e MYSQL_ROOT_PASSWORD=strongpassword -e MYSQL_DATABASE=whaticket -e MYSQL_USER=whaticket -e MYSQL_PASSWORD=whaticket --restart always -p 3306:3306 -d mariadb:latest --character-set-server=utf8mb4 --collation-server=utf8mb4_bin

    # Or run using `docker-compose` (ensure docker-compose.yml is configured for MySQL)
    # docker-compose up -d mysql

    # To administer this mysql database easily using phpmyadmin.
    # It will run by default on port 9000, but can be changed in .env using `PMA_PORT`
    # docker-compose -f docker-compose.phpmyadmin.yaml up -d
    ```

Install puppeteer dependencies:

```bash
sudo apt-get install -y libxshmfence-dev libgbm-dev wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

Clone this repo

```bash
git clone https://github.com/canove/whaticket/ whaticket
```

Go to backend folder and create .env file:

```bash
cp .env.example .env
nano .env
```

Fill `.env` file with environment variables (refer to `backend/.env.example`):
For development with SQLite (default):
```bash
NODE_ENV=DEVELOPMENT      #it helps on debugging
BACKEND_URL=http://localhost
FRONTEND_URL=http://localhost:3000
PROXY_PORT=8080
PORT=8080

DATABASE_URL="file:./dev.db" # Path to your SQLite database file, relative to the backend directory

JWT_SECRET=yourjwtsecret
JWT_REFRESH_SECRET=yourjwtrefreshsecret
```
If using MySQL, set `DATABASE_URL` accordingly (e.g., `DATABASE_URL="mysql://user:pass@host:port/db_name"`).

Install backend dependencies, build app, run migrations and (optionally) seeds:

```bash
npm install
npm run build # Compiles TypeScript
npx prisma migrate dev # Creates/updates DB schema, applies migrations
# npx prisma db seed # Optional: Runs seed script (needs to be configured in package.json and prisma/seed.ts)
```

Start backend:

```bash
npm start
```

**Frontend Setup (using Vite, React 18, MUI v5):**

Open a second terminal, go to the `frontend` folder.

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**:
    Create a `.env` file in the `frontend` directory (you can copy `frontend/.env.example`).
    Update the variables, especially `VITE_BACKEND_URL`:
    ```bash
    VITE_BACKEND_URL=http://localhost:8080 # URL of your running backend
    # VITE_HOURS_CLOSE_TICKETS_AUTO= (optional)
    ```
    *Note: Frontend variables now use the `VITE_` prefix and are accessed via `import.meta.env.VITE_...` in the code.*

3.  **Start frontend development server**:
    ```bash
    npm run dev
    ```
    This will typically start the frontend on `http://localhost:5173`.

- Go to the frontend URL (e.g., http://localhost:5173 or your server IP if deployed) and then `/signup`
- Create an user and login with it.
- On the sidebard, go to _Connections_ page and create your first WhatsApp connection.
- Wait for QR CODE button to appear, click it and read qr code.
- Done. Every message received by your synced WhatsApp number will appear in Tickets List.

## Basic production deployment

### Using Ubuntu 20.04 VPS

All instructions below assumes you are NOT running as root, since it will give an error in puppeteer. So let's start creating a new user and granting sudo privileges to it:

```bash
adduser deploy
usermod -aG sudo deploy
```

Now we can login with this new user:

```bash
su deploy
```

You'll need two subdomains forwarding to yours VPS ip to follow these instructions. We'll use `myapp.mydomain.com` to frontend and `api.mydomain.com` to backend in the following example.

Update all system packages:

```bash
sudo apt update && sudo apt upgrade
```

Install node, and confirm node command is available:

```bash
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

Install docker and add you user to docker group:

```bash
sudo apt install apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update
sudo apt install docker-ce
sudo systemctl status docker
sudo usermod -aG docker ${USER}
su - ${USER}
```

Create Mysql Database using docker:
_Note_: change MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_USER and MYSQL_ROOT_PASSWORD.

```bash
docker run --name whaticketdb -e MYSQL_ROOT_PASSWORD=strongpassword -e MYSQL_DATABASE=whaticket -e MYSQL_USER=whaticket -e MYSQL_PASSWORD=whaticket --restart always -p 3306:3306 -d mariadb:latest --character-set-server=utf8mb4 --collation-server=utf8mb4_bin

# Or run using `docker-compose` as below
# Before copy .env.example to .env first and set the variables in the file.
docker-compose up -d mysql

# To administer this mysql database easily using phpmyadmin. 
# It will run by default on port 9000, but can be changed in .env using `PMA_PORT`
docker-compose -f docker-compose.phpmyadmin.yaml up -d
```

Clone this repository:

```bash
cd ~
git clone https://github.com/canove/whaticket whaticket
```

Create backend .env file and fill with details:

```bash
cp whaticket/backend/.env.example whaticket/backend/.env
nano whaticket/backend/.env
```

```bash
NODE_ENV=
BACKEND_URL=https://api.mydomain.com      #USE HTTPS HERE, WE WILL ADD SSL LATTER
FRONTEND_URL=https://myapp.mydomain.com   #USE HTTPS HERE, WE WILL ADD SSL LATTER, CORS RELATED!
PROXY_PORT=443                            #USE NGINX REVERSE PROXY PORT HERE, WE WILL CONFIGURE IT LATTER
PORT=8080

# For production, you will likely use a robust database like PostgreSQL or MySQL.
# Ensure your DATABASE_URL in .env points to your production database.
# Example for MySQL: DATABASE_URL="mysql://user:password@host:port/database_name"
# If using MySQL, ensure your prisma/schema.prisma has `provider = "mysql"`.
DB_HOST=localhost # Relevant if not using DATABASE_URL directly for other tools, but Prisma uses DATABASE_URL
DB_DIALECT=mysql  # Prisma uses the provider in schema.prisma
DB_USER=          # Set these if your DATABASE_URL is constructed from them, otherwise DATABASE_URL is king
DB_PASS=
DB_NAME=

JWT_SECRET=yourjwtsecret_prod
JWT_REFRESH_SECRET=yourjwtrefreshsecret_prod
```

Install puppeteer dependencies:

```bash
sudo apt-get install -y libxshmfence-dev libgbm-dev wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

Install backend dependencies, build app, run migrations and (optionally) seeds:

```bash
cd whaticket/backend
npm install
npm run build
npx prisma migrate deploy # Use for production environment
# npx prisma db seed # Optional: Runs seed script
```

Start it with `npm start`, you should see: `Server started on port...` on console. Hit `CTRL + C` to exit.

Install pm2 **with sudo**, and start backend with it:

```bash
sudo npm install -g pm2
pm2 start dist/server.js --name whaticket-backend
```

Make pm2 auto start after reboot:

```bash
pm2 startup ubuntu -u `YOUR_USERNAME`
```

Copy the last line outputed from previus command and run it, its something like:

```bash
sudo env PATH=\$PATH:/usr/bin pm2 startup ubuntu -u YOUR_USERNAME --hp /home/YOUR_USERNAM
```

Go to frontend folder and install dependencies:

```bash
cd ../frontend
npm install
```

Create frontend .env file (e.g., `whaticket/frontend/.env`) and set your backend URL:

```bash
VITE_BACKEND_URL=https://api.mydomain.com/
```

Build frontend app (this will create a `dist` folder in `whaticket/frontend/`):

```bash
npm run build
```

The `server.js` previously used with Create React App is no longer the primary way to serve the frontend with Vite.
For production, you should configure a web server like Nginx to serve the static files from the `whaticket/frontend/dist` directory.
The Nginx configuration example below for `whaticket-frontend` should be updated to point its `root` videojuegos `whaticket/frontend/dist` and use `try_files` to handle client-side routing.

If you still want to use PM2 with a simple server for the frontend (less recommended than a proper Nginx setup for static files):
You could adapt the old `server.js` to serve from the `dist` folder, or use a simple static server like `serve`:
```bash
# Example using 'serve' package (install globally or as dev dependency)
# pm2 start serve --name whaticket-frontend --spa -- -s dist -l 3000
# (This assumes 'serve' is installed and 'dist' is the build output in the current dir)
# For the existing pm2 setup with server.js, you'd need to:
# 1. Go to whaticket/frontend
# 2. npm run build (output is in 'dist')
# 3. Modify server.js to serve from 'dist' instead of 'build'
# 4. Then run: pm2 start server.js --name whaticket-frontend (from whaticket/frontend)
pm2 save # To save the PM2 process list
```

To check if it's running, run `pm2 list`, it should look like:

```bash
deploy@ubuntu-whats:~$ pm2 list
┌─────┬─────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name                    │ namespace   │ version │ mode    │ pid      │ uptime │ .    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼─────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 1   │ whaticket-frontend      │ default     │ 0.1.0   │ fork    │ 179249   │ 12D    │ 0    │ online    │ 0.3%     │ 50.2mb   │ deploy   │ disabled │
│ 6   │ whaticket-backend       │ default     │ 1.0.0   │ fork    │ 179253   │ 12D    │ 15   │ online    │ 0.3%     │ 118.5mb  │ deploy   │ disabled │
└─────┴─────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘

```

Install nginx:

```bash
sudo apt install nginx
```

Remove nginx default site:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Create a new nginx site to frontend app:

```bash
sudo nano /etc/nginx/sites-available/whaticket-frontend
```

Edit and fill it with this information, changing `server_name` to yours equivalent to `myapp.mydomain.com`:

```bash
server {
  server_name myapp.mydomain.com;

  # Assuming your frontend build output is in /path/to/whaticket/frontend/dist
  root /path/to/whaticket/frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html; # Handles client-side routing
    # proxy_pass http://127.0.0.1:3333; # No longer proxying to server.js if Nginx serves static files
    # proxy_http_version 1.1; # Not needed for static files
    # proxy_set_header Upgrade $http_upgrade; # Not needed for static files
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Create another one to backend api, changing `server_name` to yours equivalent to `api.mydomain.com`, and `proxy_pass` to your localhost backend node server URL:

```bash
sudo cp /etc/nginx/sites-available/whaticket-frontend /etc/nginx/sites-available/whaticket-backend
sudo nano /etc/nginx/sites-available/whaticket-backend
```

```bash
server {
  server_name api.mydomain.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    ......
}
```

Create a symbolic links to enable nginx sites:

```bash
sudo ln -s /etc/nginx/sites-available/whaticket-frontend /etc/nginx/sites-enabled
sudo ln -s /etc/nginx/sites-available/whaticket-backend /etc/nginx/sites-enabled
```

By default, nginx limit body size to 1MB, which isn't enough for some media uploads. Lets change it to 20MB, adding a new line to config file:

```bash
sudo nano /etc/nginx/nginx.conf
...
http {
    ...
    client_max_body_size 20M; # HANDLE BIGGER UPLOADS
}
```

Test nginx configuration and restart server:

```bash
sudo nginx -t
sudo service nginx restart
```

Now, enable SSL (https) on your sites to use all app features like notifications and sending audio messages. An easy way to this is using Certbot:

Install certbot:

```bash
sudo snap install --classic certbot
sudo apt update
```

Enable SSL on nginx (Fill / Accept all information required):

```bash
sudo certbot --nginx
```

### Using docker and docker-compose

To run WhaTicket using docker you must perform the following steps:

```bash
cp .env.example .env
```

Now it will be necessary to configure the .env using its information, the variables are the same as those mentioned in the deployment using ubuntu, with the exception of mysql settings that were not in the .env. 

```bash
# MYSQL
MYSQL_ENGINE=                           # default: mariadb
MYSQL_VERSION=                          # default: 10.6
MYSQL_ROOT_PASSWORD=strongpassword      # change it please
MYSQL_DATABASE=whaticket
MYSQL_PORT=3306                         # default: 3306; Use this port to expose mysql server
TZ=America/Fortaleza                    # default: America/Fortaleza; Timezone for mysql

# BACKEND
BACKEND_PORT=                           # default: 8080; but access by host not use this port
BACKEND_SERVER_NAME=api.mydomain.com
BACKEND_URL=https://api.mydomain.com
PROXY_PORT=443
JWT_SECRET=3123123213123                # change it please
JWT_REFRESH_SECRET=75756756756          # change it please

# FRONTEND
FRONTEND_PORT=80                        # default: 3000; Use port 80 to expose in production
FRONTEND_SSL_PORT=443                   # default: 3001; Use port 443 to expose in production
FRONTEND_SERVER_NAME=myapp.mydomain.com
FRONTEND_URL=https://myapp.mydomain.com

# BROWSERLESS
MAX_CONCURRENT_SESSIONS=                # default: 1; Use only if using browserless
```

# Ensure your backend/.env file has the correct DATABASE_URL for your Docker setup.
# If using the MySQL service in docker-compose.yaml, it would be something like:
# DATABASE_URL="mysql://whaticket:whaticket@mysql:3306/whaticket"
# Also, ensure `provider = "mysql"` in `backend/prisma/schema.prisma`.

After defining the variables, run the following command:

```bash
docker-compose up -d --build
```

On the `first` run, it will be necessary to apply migrations and optionally seed the database:
```bash
docker-compose exec backend npx prisma migrate deploy
# docker-compose exec backend npx prisma db seed # Optional, if seeds are configured
```

#### SSL Certificate

To deploy the ssl certificate, add it to the `ssl/certs` folder. Inside it there should be a `backend` and a `frontend` folder, and each of them should contain the files `fullchain.pem` and `privkey.pem`, as in the structure below:

```bash
.
├── certs
│   ├── backend
│   │   ├── fullchain.pem
│   │   └── privkey.pem
│   └── frontend
│       ├── fullchain.pem
│       └── privkey.pem
└── www
```

To generate the certificate files use `certbot` which can be installed using snap, I used the following command:

Note: The frontend container that runs nginx is already prepared to receive the request made by certboot to validate the certificate.

```bash
# BACKEND
certbot certonly --cert-name backend --webroot --webroot-path ./ssl/www/ -d api.mydomain.com

# FRONTEND
certbot certonly --cert-name frontend --webroot --webroot-path ./ssl/www/ -d myapp.mydomain.com
```

## Access Data

User: admin@whaticket.com
Password: admin

## Upgrading

WhaTicket is a working in progress and we are adding new features frequently. To update your old installation and get all the new features, you can use a bash script like this:

**Note**: Always check the .env.example and adjust your .env file before upgrading, since some new variable may be added.

```bash
nano updateWhaticket
```

```bash
#!/bin/bash
echo "Updating Whaticket, please wait."

cd ~
cd whaticket
git pull
cd backend
npm install
rm -rf dist
npm run build
npx prisma migrate deploy # Apply new migrations
# npx prisma db seed # If you have seeds and want to re-apply or update them
cd ../frontend
npm install
npm run build # Generates output in 'dist' folder
# pm2 restart whaticket-frontend # If using PM2 with a custom server or 'serve'
# If Nginx serves static files directly, a pm2 restart for frontend might not be needed,
# but ensure Nginx cache is cleared obstáculos browser cache is hard refreshed.
# For simplicity, if pm2 is used for a frontend server wrapper:
pm2 restart whaticket-frontend

echo "Update finished. Enjoy!"
```

Make it executable and run it:

```bash
chmod +x updateWhaticket
./updateWhaticket
```

## Contributing

This project helps you and you want to help keep it going? Buy me a coffee:

<a href="https://www.buymeacoffee.com/canove" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 61px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

Para doações em BRL, utilize o Paypal:

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?business=VWW3BHW4AWHUY&item_name=Desenvolvimento+de+Software&currency_code=BRL)

Any help and suggestions will be apreciated.

## Disclaimer

I just started leaning Javascript a few months ago and this is my first project. It may have security issues and many bugs. I recommend using it only on local network.

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at https://whatsapp.com. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners.
