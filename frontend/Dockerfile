# Estágio 1: Build (Usando Node 22 para compatibilidade com Vite novo)
FROM node:22 as build

WORKDIR /app

# Argumentos de build para variáveis de ambiente
ARG VITE_API_URL=http://localhost:8000
ARG VITE_GATEWAY_URL=http://localhost:3000

# Define as variáveis de ambiente para o build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL

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