<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/sokratisvs/board-game-gis-app">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Board GIS App</h3>

  <p align="center">
    An awesome app to find board game buddies and geeks!
    <br />
    <!-- <a href="https://github.com/sokratisvs/board-game-gis-app"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/sokratisvs/board-game-gis-app">View Demo</a>
    ·
    <a href="https://github.com/sokratisvs/board-game-gis-app">Report Bug</a>
    ·
    <a href="https://github.com/sokratisvs/board-game-gis-app">Request Feature</a> -->
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <!-- <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li> -->
      <a href="#getting-started">Getting Started</a>
      <ul>
        <!-- <li><a href="#prerequisites">Prerequisites</a></li> -->
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <!-- <li><a href="#license">License</a></li> -->
    <li><a href="#contact">Contact</a></li>
    <!-- <li><a href="#acknowledgments">Acknowledgments</a></li> -->
  </ol>
</details>

<!-- GETTING STARTED -->

## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

### Prerequisites

Check your environment that supports at least node v18 and above

- npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/your_username_/Project-Name.git
   ```
2. Create a .env file in the root directory and enter your DB configuration in `.env`
   ```js
   DB_NAME = '<name-of-database>'
   DB_USER = '<admin-user>'
   DB_PASSWORD = '<databse-password>'
   ```
3. Using docker to create new postgres database under the command
   ```sh
   cd ./containers/postgres
   docker-compose --env-file ../../.env up -d
   ```
4. Install NPM packages & start server
   ```sh
   cd ./server
   npm install
   npm start
   ```
5. Install NPM packages & start client
   ```sh
   cd ./client
   npm install
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Sokratis Valavanis - [linkedin](https://www.linkedin.com/in/sokratis-valavanis-7010a469/) - sokratisvs@gmail.com

Project Link: [https://github.com/sokratisvs/board-game-gis-app](https://github.com/sokratisvs/board-game-gis-app)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
