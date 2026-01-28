pipeline {
  agent any

  parameters {
    choice(
      name: 'TARGET_ENV',
      choices: ['staging', 'production'],
      description: 'Deployment environment'
    )
    string(
      name: 'FRONTEND_DOMAIN',
      defaultValue: '',
      description: 'Override frontend domain (e.g. staging-apps.boardgame.tail272227.ts.net). Leave empty to use default.'
    )
    string(
      name: 'BACKEND_DOMAIN',
      defaultValue: '',
      description: 'Override backend API domain (e.g. api-staging-apps.boardgame.tail272227.ts.net). Leave empty to use default.'
    )
    choice(
      name: 'USE_HTTPS',
      choices: ['true', 'false'],
      defaultValue: 'true',
      description: 'Use HTTPS URLs (set to false if using HTTP only or Tailscale HTTPS)'
    )
  }

  stages {

    stage('Init') {
      steps {
        script {
          if (params.TARGET_ENV == 'production') {
            env.APP_DIR       = '/var/www/boardingapp/production'
            env.SSH_HOST      = 'deploy@production-apps.tail272227.ts.net'
            env.NODE_ENV      = 'production'
            env.FRONTEND_PORT = '3001'
            env.BACKEND_PORT  = '4001'
            env.HOST          = (env.SSH_HOST as String).split('@').last()
            
            // Use custom domains if provided, otherwise defaults
            def frontendDomain = params.FRONTEND_DOMAIN?.trim() ?: 'production-apps.tail272227.ts.net'
            def backendDomain = params.BACKEND_DOMAIN?.trim() ?: 'api-production.tail272227.ts.net'
            def protocol = (params.USE_HTTPS == 'true') ? 'https' : 'http'
            
            env.CLIENT_URLS = "${protocol}://${frontendDomain}"
            env.REACT_APP_API_BASE_URL = "${protocol}://${backendDomain}"
          } else {
            env.APP_DIR        = '/var/www/boardingapp/staging'
            env.SSH_HOST       = 'deploy@staging-apps.tail272227.ts.net'
            env.NODE_ENV       = 'staging'
            env.FRONTEND_PORT  = '3000'
            env.BACKEND_PORT   = '4000'
            env.HOST           = (env.SSH_HOST as String).split('@').last()
            
            // Use custom domains if provided, otherwise defaults
            def frontendDomain = params.FRONTEND_DOMAIN?.trim() ?: 'staging-apps.tail272227.ts.net'
            def backendDomain = params.BACKEND_DOMAIN?.trim() ?: 'api-staging-apps.tail272227.ts.net'
            def protocol = (params.USE_HTTPS == 'true') ? 'https' : 'http'
            
            env.CLIENT_URLS = "${protocol}://${frontendDomain}"
            env.REACT_APP_API_BASE_URL = "${protocol}://${backendDomain}"
          }
          env.COMPOSE_FILE = 'containers/docker-compose.yml'
        }
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Test SSH Connectivity') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh '''
            ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} \
            "whoami && hostname && mkdir -p ${APP_DIR}"
          '''
        }
      }
    }

    stage('Sync files to VM') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh '''
            rsync -az --delete \
              --exclude node_modules \
              --exclude .git \
              --exclude containers/postgres/data \
              ./ ${SSH_HOST}:${APP_DIR}/
          '''
        }
      }
    }

    stage('Backup Database') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh """
            ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} '
              set -e
              BACKUP_DIR=\$HOME/backups/boardingapp/${params.TARGET_ENV}
              DATA_DIR=${APP_DIR}/containers/postgres/data/pgsql
              TS=\$(date +%F_%H-%M-%S)

              mkdir -p "\$BACKUP_DIR"

              if [ -d "\$DATA_DIR" ] && [ -n "\$(ls -A \$DATA_DIR 2>/dev/null)" ]; then
                echo "📦 Backing up Postgres data..."
                tar -czf \$BACKUP_DIR/pgsql-\$TS.tar.gz -C \$DATA_DIR .
                ln -sfn \$BACKUP_DIR/pgsql-\$TS.tar.gz \$BACKUP_DIR/pgsql-latest.tar.gz
              else
                echo "📦 No data dir or empty — skipping backup"
              fi

              find \$BACKUP_DIR -type f -name "pgsql-*.tar.gz" -mtime +7 -delete 2>/dev/null || true
            '
          """
        }
      }
    }

    stage('Inject environment variables') {
      steps {
        withCredentials([
          string(credentialsId: "db_password_${params.TARGET_ENV}", variable: 'DB_PASSWORD'),
          string(credentialsId: "cookie_secret_${params.TARGET_ENV}", variable: 'COOKIE_SECRET')
        ]) {
          sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
            sh """
              ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} '
                cat > ${APP_DIR}/.env << EOF
NODE_ENV=${NODE_ENV}

DB_HOST=db
DB_PORT=5432
DB_NAME=board_gis_db
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}

COOKIE_SECRET=${COOKIE_SECRET}

FRONTEND_PORT=${env.FRONTEND_PORT}
BACKEND_PORT=${env.BACKEND_PORT}
CLIENT_URLS=${env.CLIENT_URLS}
REACT_APP_API_BASE_URL=${env.REACT_APP_API_BASE_URL}
EOF
              '
            """
          }
        }
      }
    }

    stage('Approve Production') {
      when {
        expression { params.TARGET_ENV == 'production' }
      }
      steps {
        input message: '🚨 Deploy to PRODUCTION?'
      }
    }

    stage('Build & Deploy (Docker)') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh """
            ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} '
              set -e
              cd ${APP_DIR}
              docker compose -f ${COMPOSE_FILE} --env-file .env down --remove-orphans || true
              docker rm -f postgres backend frontend 2>/dev/null || true
            '
          """
          sh """
            ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} '
              cd ${APP_DIR} &&
              docker compose -f ${COMPOSE_FILE} --env-file .env build
            '
          """
          sh """
            ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} '
              cd ${APP_DIR} &&
              docker compose -f ${COMPOSE_FILE} --env-file .env up -d
            '
          """
        }
      }
    }
  }

  post {
    success {
      echo "✅ ${params.TARGET_ENV.toUpperCase()} deployment successful"
    }
    failure {
      echo "❌ ${params.TARGET_ENV.toUpperCase()} deployment failed"
      sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
        sh """
          ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} '
            set -e
            BACKUP_DIR=\$HOME/backups/boardingapp/${params.TARGET_ENV}
            DATA_DIR=${APP_DIR}/containers/postgres/data/pgsql

            if [ -f "\$BACKUP_DIR/pgsql-latest.tar.gz" ]; then
              echo "↩️ Restoring Postgres data from last backup..."
              docker stop postgres 2>/dev/null || true
              docker rm -f postgres 2>/dev/null || true
              mkdir -p \$DATA_DIR
              rm -rf \$DATA_DIR/*
              tar -xzf \$BACKUP_DIR/pgsql-latest.tar.gz -C \$DATA_DIR
              echo "✓ Restore done. Re-run the pipeline to deploy."
            else
              echo "⚠️ No backup found — skipping restore"
            fi
          '
        """
      }
    }
  }
}
