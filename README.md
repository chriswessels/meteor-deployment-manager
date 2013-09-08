#meteor-deployment-manager
Meteor Deployment Manager (or MDM for short) is a command line tool intended to automate the process of deploying your [Meteor](http://www.meteor.com/) applications to self-hosted infrastructure like Amazon EC2.

**NB: You have found this project in its infancy. The best documentation at the moment is the source code, so check it out!**

##Features
- Written in pure JavaScript.
- Installs as a global NPM package, accessible from any directory.
- Supports multiple deployment environments and configurations.
- Supports predefined password, private key and keyboard-interactive authentication.
- Uses symbolic links to retain build history.
- Uses [Upstart](http://upstart.ubuntu.com) to monitor Node.js.

##How it works

MDM makes itself available with the `mdm` command line program. When executing MDM, it will look for a `deploy.json` file in the current working directory by default. You can change this behaviour with the `--project-path` and `--config-file` command line arguments. Your `deploy.json` contains information about your deployment environments and project options.

###Example usage

####Sample `deploy.json`
```json
{
  "options": {
    "meteorite": true,
    "insecure": false,
    "meteorRelease": "0.6.5"
  },
  "environments": {
    "staging": {
      "hostname": "staging.your-app.com",
      "port": 22,
      "username": "meteor",
      "password": "secure-password",
      "deploymentDirectory": "your-app",
      "gitBranch": "master",
      "taskName": "your-app"
    },
    "production": {
      "hostname": "your-app.com",
      "port": 22,
      "username": "meteor",
      "password": "secure-password",
      "deploymentDirectory": "your-app",
      "gitBranch": "master",
      "taskName": "your-app"
    }
  }
}
```

##Installation

MDM is installed using the [Node Package Manager](https://npmjs.org) command line tool. MDM should be installed with the global flag (-g) to ensure that it is available within any Meteor application directory you might want to deploy. Install MDM with the following command:

```sh
npm install -g meteor-deployment-manager
```

You can generate a sample `deploy.json` file using the `--generate` command line argument. This will create a sample `deploy.json` file in the current working directory. You should customise it to match your requirements.
