pipeline {
  agent any

  parameters {
    choice(
      name: 'TARGET_ENV',
      choices: ['staging', 'production'],
      description: 'Deployment environment'
    )
    booleanParam(
      name: 'CLEAN_BUILD',
      defaultValue: false,
      description: 'Force backend rebuild with --no-cache'
    )
  }

  stages {

    stage('Clean Jenkins Workspace') {
      steps {
        deleteDir()
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
        sh '''
          echo "📌 Commit: $(git rev-parse --short HEAD) $(git log -1 --oneline)"
        '''
      }
    }

    stage('Init') {
      steps {
        script {
          if (params.TARGET_ENV == 'production') {
            env.APP_DIR       = '/var/www/boardgames/production'
            env.SSH_HOST      = 'deploy@production-apps.tail272227.ts.net'
            env.NODE_ENV      = 'production'
            env.FRONTEND_PORT = '3001'
            env.BACKEND_PORT  = '4001'
            env.CLIENT_URLS   = 'https://production-apps.tail272227.ts.net'
          } else {
            env.APP_DIR       = '/var/www/boardgames/staging'
            env.SSH_HOST      = 'deploy@staging-apps.tail272227.ts.net'
            env.NODE_ENV      = 'staging'
            env.FRONTEND_PORT = '3000'
            env.BACKEND_PORT  = '4000'
            env.CLIENT_URLS   = 'https://staging-apps.tail272227.ts.net'
          }

          env.BUILD_HASH = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()
        }
      }
    }

    stage('Test SSH Connectivity') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh "ssh ${env.SSH_HOST} 'whoami && hostname && mkdir -p ${env.APP_DIR}'"
        }
      }
    }

    stage('Sync files to VM') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh '''
            rsync -az --delete \
              --exclude .git \
              --exclude node_modules \
              --exclude containers/postgres/data \
              ./ ${SSH_HOST}:${APP_DIR}/
          '''
        }
      }
    }

    stage('Verify synced files on VM') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh """
            ssh ${env.SSH_HOST} '
              set -e
              test -f "${env.APP_DIR}/docker-compose.yml" || { echo "Missing docker-compose.yml"; exit 1; }
              grep -q "frontend:" "${env.APP_DIR}/docker-compose.yml" || { echo "Missing frontend service"; exit 1; }
              grep -q "backend:" "${env.APP_DIR}/docker-compose.yml" || { echo "Missing backend service"; exit 1; }
              echo "✓ docker-compose.yml verified"
            '
          """
        }
      }
    }

    stage('Backup Database') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh """
            ssh ${env.SSH_HOST} '
              set -e
              BACKUP_DIR=\$HOME/backups/boardgames/${params.TARGET_ENV}
              DATA_DIR=${env.APP_DIR}/containers/postgres/data/pgsql
              TS=\$(date +%F_%H-%M-%S)

              mkdir -p "\$BACKUP_DIR"

              if [ -d "\$DATA_DIR" ] && [ -n "\$(ls -A \$DATA_DIR 2>/dev/null)" ]; then
                tar -czf \$BACKUP_DIR/pgsql-\$TS.tar.gz -C \$DATA_DIR .
                ln -sfn \$BACKUP_DIR/pgsql-\$TS.tar.gz \$BACKUP_DIR/pgsql-latest.tar.gz
              else
                echo "📦 No DB data — skipping backup"
              fi

              find "\$BACKUP_DIR" -type f -name "pgsql-*.tar.gz" -mtime +7 -delete || true
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
              ssh ${env.SSH_HOST} '
                cat > ${env.APP_DIR}/.env << EOF
NODE_ENV=${env.NODE_ENV}

DB_HOST=db
DB_PORT=5432
DB_NAME=board_gis_db
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}

COOKIE_SECRET=${COOKIE_SECRET}

FRONTEND_PORT=${env.FRONTEND_PORT}
BACKEND_PORT=${env.BACKEND_PORT}
CLIENT_URLS=${env.CLIENT_URLS}

VITE_API_BASE_URL=/api
VITE_BUILD_HASH=${env.BUILD_HASH}
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
            ssh ${env.SSH_HOST} '
              set -e
              cd ${env.APP_DIR}

              echo "🧹 Stopping containers..."
              docker compose down --remove-orphans || true

              echo "🎨 Rebuilding FRONTEND (always no-cache)..."
              docker compose build --no-cache frontend

              echo "🧠 Rebuilding BACKEND..."
              if [ "${params.CLEAN_BUILD}" = "true" ]; then
                docker compose build --no-cache backend
              else
                docker compose build backend
              fi

              echo "🚀 Starting containers..."
              docker compose up -d --force-recreate
            '
          """
        }
      }
    }

    stage('Verify Containers Health') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh """
            ssh ${env.SSH_HOST} '
              set -e
              for i in {1..20}; do
                UNHEALTHY=\$(docker ps --filter "health=unhealthy" --format "{{.Names}}")
                if [ -z "\$UNHEALTHY" ]; then
                  echo "✅ All containers healthy"
                  exit 0
                fi
                sleep 5
              done
              echo "❌ Containers unhealthy"
              docker ps
              exit 1
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
    }
  }
}
