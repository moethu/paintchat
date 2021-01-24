let lineThickness = 1;

function setThickness(weight) {
    lineThickness = weight;
}

function getPosition(mouseEvent, sigCanvas) {
    var x, y;
    if (mouseEvent.pageX != undefined && mouseEvent.pageY != undefined) {
        x = mouseEvent.pageX;
        y = mouseEvent.pageY;
    } else {
        x = mouseEvent.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        y = mouseEvent.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    return { X: x - sigCanvas.offsetLeft, Y: y - sigCanvas.offsetTop };
}

function invertColor(hex, bw) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    var r = parseInt(hex.slice(0, 2), 16),
        g = parseInt(hex.slice(2, 4), 16),
        b = parseInt(hex.slice(4, 6), 16);
    if (bw) {
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186
            ? '#000000'
            : '#FFFFFF';
    }
    r = (255 - r).toString(16);
    g = (255 - g).toString(16);
    b = (255 - b).toString(16);
    return "#" + padZero(r) + padZero(g) + padZero(b);
}

function websocketSend(ws, drawing, x, y, newpath) {
    if (ws) {
        ws.send(`{"d":${drawing},"x":${x},"y":${y},"s":${newpath},"w":${lineThickness}}`);
    }
}

function moveLabel(id, x_pos, y_pos) {
    var d = document.getElementById(`label_${id}`);
    d.style.position = "absolute";
    d.style.left = x_pos + 'px';
    d.style.top = y_pos + 'px';
}

function copyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = 0;
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copying text command was ' + msg);
    } catch (err) {
        console.log('Oops, unable to copy');
    }

    document.body.removeChild(textArea);
}

function copyLink() {
    copyTextToClipboard(location.href);
}

function addOrGetCanvas(id, col) {
    var layer = document.getElementById(id)
    if (layer) {
        return layer
    }

    var canvas = document.createElement('canvas');
    var div = document.getElementById("canvasDiv");
    canvas.id = id;
    canvas.width = 600;
    canvas.height = 600;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.zIndex = -1;
    canvas.style.position = "absolute";
    div.appendChild(canvas)

    var label = document.createElement('div');
    label.id = "label_" + id;
    label.innerHTML = id
    label.className = "label"
    label.style.backgroundColor = col
    label.style.color = invertColor(col, true)

    div.appendChild(label)

    return canvas
}

function initialize(board) {
    url = `ws://${window.location.hostname}${location.port ? ':' + location.port : ''}/session/${board}`
    ws = new WebSocket(url);
    document.getElementById("erase").onclick = function () { ws.send(`{"e":true}`); };
    ws.onopen = function (evt) {
        console.log("Connected to Server", url);
    }
    ws.onclose = function (evt) {
        console.log("Closed Connection");
        ws = null;
    }

    ws.onmessage = function (evt) {
        msg = JSON.parse(evt.data)
        var canvas = addOrGetCanvas(msg.n, msg.c)
        context = canvas.getContext("2d")
        if (msg.e) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            context.strokeStyle = msg.c;
            if (msg.s) {
                context.beginPath();
                context.moveTo(msg.x, msg.y);
            } else {
                context.lineTo(msg.x, msg.y);
                context.stroke();
                context.lineWidth = msg.w;
                context.shadowColor = msg.c;
                context.shadowBlur = 1;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
                moveLabel(msg.n, msg.x, msg.y)
            }
        }
    }

    var sigCanvas = document.getElementById("canvasSignature");
    sigCanvas.width = window.innerWidth;
    sigCanvas.height = window.innerHeight;
    var context = sigCanvas.getContext("2d");
    var is_touch_device = 'ontouchstart' in document.documentElement;

    if (is_touch_device) {
        var drawer = {
            isDrawing: false,
            touchstart: function (coors) {
                this.isDrawing = true;
                websocketSend(ws, this.isDrawing, coors.x, coors.y, true)
            },
            touchmove: function (coors) {
                if (this.isDrawing) {
                    websocketSend(ws, this.isDrawing, coors.x, coors.y, false)
                }
            },
            touchend: function (coors) {
                if (this.isDrawing) {
                    this.touchmove(coors);
                    this.isDrawing = false;
                    websocketSend(ws, this.isDrawing, coors.x, coors.y, false)
                }
            }
        };
        function draw(event) {
            var coors = {
                x: event.targetTouches[0].pageX,
                y: event.targetTouches[0].pageY
            };
            var obj = sigCanvas;

            if (obj.offsetParent) {
                do {
                    coors.x -= obj.offsetLeft;
                    coors.y -= obj.offsetTop;
                }
                while ((obj = obj.offsetParent) != null);
            }
            drawer[event.type](coors);
        }
        sigCanvas.addEventListener('touchstart', draw, false);
        sigCanvas.addEventListener('touchmove', draw, false);
        sigCanvas.addEventListener('touchend', draw, false);
        sigCanvas.addEventListener('touchmove', function (event) {
            event.preventDefault();
        }, false);
    }
    else {
        $("#canvasSignature").mousedown(function (mouseEvent) {
            var position = getPosition(mouseEvent, sigCanvas);
            websocketSend(ws, true, position.X, position.Y, true)
            $(this).mousemove(function (mouseEvent) {
                drawLine(mouseEvent, sigCanvas, context, true);

            }).mouseup(function (mouseEvent) {
                finishDrawing(mouseEvent, sigCanvas, context);

            }).mouseout(function (mouseEvent) {
                finishDrawing(mouseEvent, sigCanvas, context);
            });
        });
    }
}

function drawLine(mouseEvent, sigCanvas, context, drawing) {
    var position = getPosition(mouseEvent, sigCanvas);
    websocketSend(ws, drawing, position.X, position.Y, false)
}

function finishDrawing(mouseEvent, sigCanvas, context) {
    drawLine(mouseEvent, sigCanvas, context, false);
    $(sigCanvas).unbind("mousemove")
        .unbind("mouseup")
        .unbind("mouseout");
}