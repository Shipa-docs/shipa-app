import type { Probot } from "probot";
import type { Context } from "probot";

// Interfaces para los tipos
interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

// Array de emojis para usar en las sugerencias
const emojis = ["✅", "🚀", "👍", "🎉", "🔥", "💯", "⭐", "🌟", "💪", "👏"];

export default (app: Probot) => {
  // Log all events received by the bot
  app.log.info("Starting the bot...");

  // Log webhooks in a simpler way
  app.onAny(async (context) => {
    app.log.info(`Received event: ${context.name}`);
    app.log.info(`Payload: ${JSON.stringify(context.payload)}`);
    app.log.info(`Repository: ${context}`);
  });

  // Helper function to get commit details
  async function getCommitDetails(context: Context, owner: string, repo: string, commitSha: string) {
    try {
      // Get detailed commit information including files changed
      const { data: commitDetails } = await context.octokit.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });

      app.log.info(`Commit ${commitSha} details:`);
      app.log.info(`Total files changed: ${commitDetails.files?.length || 0}`);

      // Log details of each changed file
      if (commitDetails.files && commitDetails.files.length > 0) {
        for (const file of commitDetails.files as CommitFile[]) {
          app.log.info(`File: ${file.filename}`);
          app.log.info(`Status: ${file.status}`); // added, modified, removed
          app.log.info(`Changes: +${file.additions} -${file.deletions}`);

          // Log a sample of the patch if it exists
          if (file.patch) {
            app.log.info(`Patch preview: ${file.patch.substring(0, 200)}${file.patch.length > 200 ? '...' : ''}`);
          }

          // Get the full content of the file in this commit
          if (file.status !== 'removed') {
            await getFileContent(context, owner, repo, commitSha, file.filename);
          }
        }
      }

      return commitDetails;
    } catch (error) {
      app.log.error(`Error fetching commit details: ${error}`);
      return null;
    }
  }

  // Helper function to get the full content of a file in a specific commit
  async function getFileContent(context: Context, owner: string, repo: string, commitSha: string, filePath: string) {
    try {
      // Get the content of the file at this specific commit
      const { data: fileData } = await context.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: commitSha,
      });

      app.log.info(`Obteniendo contenido completo de: ${filePath} en commit ${commitSha}`);

      // The content is base64 encoded
      if ('content' in fileData && typeof fileData.content === 'string') {
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        app.log.info('Contenido completo del archivo (primeras 300 caracteres):');
        app.log.info(content.substring(0, 300) + (content.length > 300 ? '...' : ''));

        // You could save this to a file, database, or return it
        return content;
      }

      app.log.info('No se pudo obtener el contenido del archivo (probablemente es un directorio o archivo binario)');
      return null;
    } catch (error) {
      app.log.error(`Error obteniendo contenido del archivo ${filePath}: ${error}`);
      return null;
    }
  }

  // Función para crear sugerencias en el PR con emojis
  async function createSuggestionWithEmoji(
    context: Context,
    owner: string,
    repo: string,
    pullNumber: number,
    commitId: string,
    filePath: string,
    patch: string
  ) {
    try {
      // Analizar el patch para encontrar las líneas añadidas o modificadas
      const lines = patch.split('\n');
      const suggestions = [];

      // Procesar cada línea del patch
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Buscar líneas que comienzan con '+' (añadidas/modificadas) pero no las líneas de metadata (+++/---)
        if (line.startsWith('+') && !line.startsWith('+++')) {
          // Obtener la línea sin el prefijo '+'
          const codeLine = line.substring(1);

          // Sacar un emoji aleatorio del array
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

          // Crear la sugerencia con el emoji añadido al final
          const suggestionLine = `${codeLine} ${randomEmoji}`;

          // Guardar información para crear la sugerencia
          suggestions.push({
            line: i,
            content: suggestionLine,
            originalLine: codeLine
          });
        }
      }

      // Si hay sugerencias para hacer
      if (suggestions.length > 0) {
        app.log.info(`Creando ${suggestions.length} sugerencias para el archivo ${filePath}`);

        // Para cada sugerencia, crear un comentario en la revisión del PR
        for (const suggestion of suggestions) {
          // Determinar la posición en el archivo
          // Nota: Esto es una aproximación simple, la posición real puede ser más compleja de calcular
          let position = 1;
          for (let j = 0; j <= suggestion.line; j++) {
            if (lines[j]?.startsWith('@@ ')) {
              const match = lines[j].match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
              if (match?.[1]) {
                position = Number.parseInt(match[1], 10) - 1;
              }
            } else if (!lines[j]?.startsWith('-')) {
              position++;
            }
          }

          // Crear el comentario con la sugerencia
          const body = [
            'Sugerencia: añadir un emoji al final de esta línea 😊',
            '```suggestion',
            suggestion.content,
            '```'
          ].join('\n');

          try {
            // Crear el comentario de revisión
            await context.octokit.pulls.createReviewComment({
              owner,
              repo,
              pull_number: pullNumber,
              body,
              commit_id: commitId,
              path: filePath,
              position, // La posición en el archivo
            });

            app.log.info(`Sugerencia creada exitosamente para la línea ${position} en ${filePath}`);
          } catch (commentError) {
            app.log.error(`Error al crear la sugerencia: ${commentError}`);
          }
        }
      }
    } catch (error) {
      app.log.error(`Error al analizar el patch y crear sugerencias: ${error}`);
    }
  }

  app.on("pull_request.synchronize", async (context) => {
    app.log.info("Received pull_request.synchronize event");

    // Extract basic PR information
    const repo = context.payload.repository.full_name;
    const prNumber = context.payload.pull_request.number;
    const headSha = context.payload.pull_request.head.sha;
    const beforeSha = context.payload.before;
    const afterSha = context.payload.after;

    app.log.info(`PR #${prNumber} in ${repo} was synchronized`);
    app.log.info(`Head commit: ${headSha}`);
    app.log.info(`Changed from ${beforeSha} to ${afterSha}`);

    try {
      // Fetch commits in this PR
      const { data: commits } = await context.octokit.pulls.listCommits({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: prNumber,
      });

      app.log.info(`Found ${commits.length} commits in this PR`);

      // Process each commit
      for (const commit of commits) {
        app.log.info(`Commit: ${commit.sha}`);
        app.log.info(`Author: ${commit.commit.author?.name || 'Unknown'} <${commit.commit.author?.email || 'No email'}>`);
        app.log.info(`Message: ${commit.commit.message || 'No message'}`);

        // Get detailed changes for this commit
        const commitDetails = await getCommitDetails(
          context,
          context.payload.repository.owner.login,
          context.payload.repository.name,
          commit.sha
        );

        // Crear sugerencias para cada archivo modificado
        if (commitDetails?.files) {
          for (const file of commitDetails.files) {
            if (file.patch) {
              await createSuggestionWithEmoji(
                context,
                context.payload.repository.owner.login,
                context.payload.repository.name,
                prNumber,
                commit.sha,
                file.filename,
                file.patch
              );
            }
          }
        }
      }

      // Get detailed difference between the base and head
      app.log.info(`Getting diff between ${beforeSha} and ${afterSha}`);
      const { data: comparison } = await context.octokit.repos.compareCommits({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        base: beforeSha,
        head: afterSha,
      });

      app.log.info(`Comparison status: ${comparison.status}`);
      app.log.info(`Total commits in diff: ${comparison.total_commits}`);
      app.log.info(`Files changed: ${comparison.files?.length || 0}`);

    } catch (error) {
      app.log.error(`Error fetching commit data: ${error}`);
    }
  });

  // Handle individual commit push events to get detailed changes
  app.on("push", async (context) => {
    const commits = context.payload.commits;
    const repository = context.payload.repository;

    app.log.info(`Received push with ${commits.length} commits`);

    for (const commit of commits) {
      app.log.info(`Processing commit: ${commit.id}`);
      app.log.info(`Commit message: ${commit.message}`);

      // Get owner login safely
      const ownerLogin = repository.owner.login || repository.owner.name || '';
      if (!ownerLogin) {
        app.log.error('Could not determine repository owner');
        continue;
      }

      // Get detailed changes for this commit
      await getCommitDetails(
        context,
        ownerLogin,
        repository.name,
        commit.id
      );
    }
  });
};
