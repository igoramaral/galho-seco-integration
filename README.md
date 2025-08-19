# :game_die: Galho Seco Integratrion - A Foundry VTT Module

![GitHub top language](https://img.shields.io/github/languages/top/igoramaral/galho_seco_integration)
[![Author](https://img.shields.io/badge/Author-Igor%20Amaral-blue)](https://github.com/igoramaral)

Galho Seco Integration is a Foundry VTT module designed to D&D 5E that integrates Galho Seco App to Foundry VTT. This allows users of the App to see their character sheet and make rolls directly from the app to Foundry.
This project is part of the final project for the Computer and Information Engineering degree at Federal University of Rio de Janeiro (UFRJ)

## 📖 Table of Contents

- [About the Project](#about-the-project)
- [Built with](#built-with)
- [Installation](#installation)
- [Usage](#usage)
- [Running Tests](#running-tests)
- [License](#license)
- [Author](#author)

## About the Project

The goal of this project is to build a D&D character sheet manager app for Android devices.

Galho Seco will allow users to create, edit and rolls tests on their D&D character sheet wherever and whenever they want.

One of the main goals of this project is to integrate the app with [Foundry VTT](https://foundryvtt.com) to allow players to roll tests for their characters without the need of being connected to Foundry VTT.
This will allow players that don't own laptops or computers to play with other players connected to Foundry VTT, since Foundry does not have a mobile client yet.

The app uses the backend provided by [Galho Seco API](https://github.com/igoramaral/galho-seco-api), another project in the Galho Seco environment. See that project for more information on how it works or how to run it.

## Installation

Install the module directly from the manifest.json provided:
https://raw.githubusercontent.com/igoramaral/galho-seco-integration/main/manifest.json

## Usage

To use, the GM needs to enable the module first. After that, there will be a few configs left to do:

1. On the config menu, add the Galho Seco Api server url;
2. On the users button, click, select a user you want to integrate and add the api key provided by the user. Do it for every user you want to sync.
3. Configure the interval the module should send chars to the server. Default is 10 minutes.

For the module to work, the GM must be connected to the world.
The module will send data to the server on the programmed interval. It will also send data every time a synched character receives an update (on a value, item, etc.).
For the rolls to be received, the GM must be connected and the connection to the server must be on. If you want to be sure, refresh the browser and check the console to see if the connection was established.

## Author

**Igor Dominices Baía do Amaral**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/igoramaral)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/igor-db-amaral/)
