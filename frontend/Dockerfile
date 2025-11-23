# Estágio 1: Build (Usando Node 22 para compatibilidade com Vite novo)
FROM node:22 as build

WORKDIR /app

# Copia arquivos de dependência primeiro para aproveitar cache
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante do projeto
COPY . .

# Executa o build
RUN npm run build

# Estágio 2: Servidor Web leve (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]