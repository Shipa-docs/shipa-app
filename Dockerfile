FROM node:20-slim
WORKDIR /usr/src/app

# Copiar archivos de configuración y dependencias
COPY package.json package-lock.json tsconfig.json ./

# Copiar el código fuente
COPY src/ ./src

# Instalar dependencias
RUN npm ci

# Ejecutar el build (compila TypeScript y genera la carpeta lib)
RUN npm run build

# Establecer el entorno de producción
ENV NODE_ENV="production"

# Si tienes otros archivos (como .env, etc.) que necesites, puedes copiarlos aquí
# COPY . .

# Iniciar la aplicación
CMD [ "npm", "start" ]