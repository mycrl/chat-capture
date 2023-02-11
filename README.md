# Chat Capture

Use the Microsoft Edge that comes with the windows system to run in headless mode to capture live room chat messages in real time.

## Usage

```bash
chat-capture --kind=[douyin/tiktok] --room=[room number/user id]
```

> If not logged in, the browser will pop up asking the user to log in.

Note: This tool will create a `.edge_app_data` directory under the working directory, which stores the user data of the Edge browser, be careful not to delete it.

## Building

#### Prerequisites

You need to install the Node.js toolchain, if you have already installed it, you can skip it, [Install Node.js](https://nodejs.org/en/download/).

#### Build binary

Compile the entire workspace in release mode:

```bash
npm i
npm run pkg
```

After the compilation is complete, you can find the binary file in the current directory.