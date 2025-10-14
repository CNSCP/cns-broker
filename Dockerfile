FROM node:22

# Install the appliation
WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm install

COPY . /app/

# Start in kubernetes mode
CMD ["npm", "run", "production"]
