FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
# Instalar todas las dependencias para poder compilar
RUN npm ci
# Ejecutar el build (asegúrate de que el script "build" esté definido en package.json)
RUN npm run build
# Si quieres limpiar devDependencies, puedes hacerlo en una etapa separada o usar otras estrategias
ENV NODE_ENV="production"
# Copiar el resto del código (incluida la carpeta generada lib)
COPY . .
CMD [ "npm", "start" ]