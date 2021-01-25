# paintchat

a simple digital chalkboard written in go.

![](https://raw.githubusercontent.com/moethu/paintchat/main/static/screenshot.png)

the server is similar to a chat server with rooms implemented using go channels. each client is streaming its drawing actions to the server throgh a websocket. the server then broadcasts changes to all other clients in the same room. As long as a client stays connected all its streamed data remains buffered at the server. If a new client connects it first gets a random name and color assigned and then receives all drawing history form all other currently connected clients. Once a user leaves a room all her drawing data will be lost.

### Feature list

- enters a random board for connections at root
- common hangout board called "cheers"
- copy board url on click
- three different pencil sizes
- random name and color assignment
- erase all what you've been drawing so far
- save drawing as png

### Dependencies

All dependencies are installed using go modules.

### Build & run

simply run `go build .` or `go run` to build.

### Contribute

You are welcome to open pull-request or simply report feature requests or issues.
