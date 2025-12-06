FROM node:20

WORKDIR /app

# Copia o arquivo de dependências
COPY package.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

EXPOSE 5173

# Comando para rodar o servidor de desenvolvimento do Vite
CMD ["npm", "run", "dev"]