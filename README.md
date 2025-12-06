# 🫀 CalciVision

Plataforma web inovadora, que utiliza modelos de classificação, para análise automatizada de calcificações na válvula aórtica.
A plataforma auxilia os médicos cardiologistas no diagnóstico de estenose aórtica, elaboração dos relatórios médicos com IA e na gestão dos pacientes, automatizando assim o fluxo hospitalar. 


## 🏗️ Arquitetura do Sistema
A aplicação está dividida em três grandes blocos: **Frontend**, **Backend** e **Processamento de ML**.

### Componentes:
- **Frontend**: React + Vite + TailwindCSS  
  - **Função**: Interface do usuário para upload de imagens, visualização de resultados, anotações manuais, criação de relatórios.  
  - **Isolamento**: Possui seu próprio contêiner Docker, expõe a porta `5173` para desenvolvimento.
  
- **Backend**: Django + Django REST Framework + Django Channels (WebSockets)  
  - **Função**: API REST autenticada (JWT) para manipulação de dados (pacientes, exames, etc.).  
  - **Gerenciamento de tarefas assíncronas** com Celery (usando Redis como broker).  
  - **Servidor ASGI** para WebSockets (progresso de tarefas, resultados de ML em tempo real).  
  - **Integração com modelos de Machine Learning**:  
    - ONNX para detecção de válvula.  
    - Keras/TensorFlow para classificação de cálcio.  
  - **Isolamento**: Possui seu próprio contêiner Docker. O entrypoint executa migrações, coleta estáticos, inicia Celery, Daphne (ASGI) e o servidor Django.  

- **MLModels**: ONNX e Keras/TensorFlow  
  - **Integração**: Os modelos de ML (ONNX e Keras) são carregados diretamente pelo backend Django, não há um serviço ML separado.  
  - **Execução**: As tarefas de inferência são executadas por Celery workers, que rodam dentro do mesmo contêiner do backend.  

- **BD**: MySQL  
  - **Função**: Armazena dados estruturados do sistema, incluindo informações de usuários (médicos), pacientes, ecocardiogramas, frames, anotações, resultados de inferência e permissões.  
  - **Integração**: Utilizado como banco de dados principal pelo backend Django via ORM (Django Models). Todas as operações CRUD do backend são persistidas no MySQL.  
  - **Isolamento**: Roda em seu próprio contêiner Docker, separado do backend e frontend.  
  - **Migrações**: O backend Django executa automaticamente as migrações para criar e atualizar o schema do banco de dados conforme os modelos definidos no código.  
  - **Segurança**: O acesso ao banco é restrito ao backend, não sendo exposto diretamente para fora do ambiente Docker.
    
## 🧱 Tecnologias Utilizadas 

| **Camada**      | **Tecnologias**                          |
|-----------------|-----------------------------------------|
| **Frontend**    | ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwind-css&logoColor=white) ![Radix](https://img.shields.io/badge/Radix-Framework-blue?style=for-the-badge&logo=radix-ui)             |
| **Backend**     | ![Django](https://img.shields.io/badge/Django-092E20?logo=django&logoColor=white) ![Celery](https://img.shields.io/badge/Celery-37814A?logo=celery&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)   |
| **ML/AI**       | ![ONNX](https://img.shields.io/badge/ONNX-005CED?logo=onnx&logoColor=white) ![Keras](https://img.shields.io/badge/Keras-D00000?logo=keras&logoColor=white) ![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?logo=tensorflow&logoColor=white)                 |
| **Contêineres** | ![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)                                 |
| **Auth**        | ![JWT](https://img.shields.io/badge/JWT-000000?logo=json-web-tokens&logoColor=white)                   |



















-----------------------------------------------------------

Para correr o projeto:
`docker compose up --build`
ou
`docker compose build` + `docker compose up`

Acessar o **frontend**:
- http://localhost:5173

Acessar a **API do backend**:
- http://localhost:8000/api/hello/

Acessar a **base de dados** na extensão do VS Code.

## Setup

O projeto tem os seguintes serviços:
- **django_backend**: O container onde corre o servidor e a API.
- **react_frontend**: O container onde corre o React com Vite e gera-se os arquivos estáticos (HTML, CSS, imagens, etc).
- **mysql_database**: O sistema operativo onde está configurada a base de dados MySQL.
- **redis_broker**: O container onde está instalado o Redis, importante para executar os algoritmos em paralelo ao servidor Django para não entupi-lo.

Depois também será configurado um **nginx_proxy** que servirá como proxy reverso, load balancer e enviará os arquivos estáticos gerados pelo frontend (HTML, CSS, imagens, etc) para os browsers dos utilizadores. Por agora, o servidor corre no localhost e não precisamos do NGINX para servir os arquivos estáticos para nós mesmos.

### Ambiente Virtual

Durante o desenvolvimento no **Django** é preferível utilizar o Python 3.11.9 e criar uma ambiente virtual (com venv) na pasta do backend com a mesma versão do Python (3.11.9). Este passo não é necessário porque dentro do container tudo vai estar configurado corretamente, mas na máquina local, o VS Code pode indicar erros e conflitos entre versões do tensorflow e django caso não se use a versão 3.11.9.

Criar um ambiente virtual também é opcional mas é uma boa prática. Já com o Python 3.11.9 instalado,:

1. Instalar o venv (se ainda não estiver instalado):

`py -3.11 -m pip install venv`

2. Criar ambiente virtual no backend:

`cd backend`
`py -3.11 -m venv env`

3. Ativar ambiente virtual:

`env\Scripts\activate`

4. Instalar todas as dependências

`py -m pip install -r requirements.txt`

Para desativar: `env\Scripts\deactivate`, ou simplesmente fechar o terminal. É preciso ativar o ambiente cada vez que se entra no projeto.
