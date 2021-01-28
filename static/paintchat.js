class Layer {
    constructor(name, color, canvas) {
        this.name = name
        this.color = color
        this.canvas = canvas
        this.thickness = 1
        this.erasor = false
        this.pointBuffer = {}
    }

    setThickness(t) { this.thickness = t }

    send(socket, x, y, isDrawing, isStart) {
        let path = new PathInfo(x, y, isDrawing, isStart, this.thickness, this.color, this.name, this.erasor)
        this.drawPathInfo(path)
        if (socket) {
            socket.send(JSON.stringify(path))
        }
    }

    drawPathInfo(msg) {
        let context = this.canvas.getContext("2d")
        context.strokeStyle = msg.c
        if (msg.s) {
            if (msg.e) {
                this.pointBuffer = new Point(msg.x, msg.y)
            } else {
                context.beginPath()
                context.moveTo(msg.x, msg.y)
            }
        } else {
            if (msg.e) {
                Erasor.ErasePath(context, this.pointBuffer, new Point(msg.x, msg.y), msg.w * 6)
                this.pointBuffer = new Point(msg.x, msg.y)
            } else {
                context.lineTo(msg.x, msg.y)
                context.lineWidth = msg.w
                context.shadowColor = msg.c
                context.shadowBlur = 1
                context.shadowOffsetX = 0
                context.shadowOffsetY = 0
                context.stroke()
            }
            this.moveLabel(msg.x, msg.y)
        }
    }

    moveLabel(x, y) {
        let d = document.getElementById(`label_${this.name}`)
        d.style.visibility = "visible"
        d.style.position = "absolute"
        d.style.left = x + 'px'
        d.style.top = y + 'px'
    }

    changeColor(color) {
        let d = document.getElementById(`label_${this.name}`)
        d.style.background = color
        d.style.color = chalkBoard.invertColor(color, true)
        this.color = color
    }

    erase() {
        if (this.erasor == true) {
            this.erasor = false
            document.getElementById("erase").style.color = ""
        }
        else {
            document.getElementById("erase").style.color = "#555"
            this.erasor = true
        }
    }
}

class PathInfo {
    constructor(x, y, isDrawing, isStart, thickness, color, name, erase) {
        this.d = isDrawing
        this.x = x
        this.y = y
        this.s = isStart
        this.w = thickness
        this.c = color
        this.n = name
        this.e = erase
    }
}

class Point {
    constructor(x, y) {
        this.x = x
        this.y = y
    }
}

class Erasor {
    static DistanceBetweenTwoPoins(p1, p2) {
        let a = p1.x - p2.x
        let b = p1.y - p2.y
        return Math.sqrt(a * a + b * b)
    }

    static DivideIntoSegments(startPoint, endPoint, segments) {
        let dx = (endPoint.x - startPoint.x) / segments
        let dy = (endPoint.y - startPoint.y) / segments
        let points = []
        for (let i = 1; i < segments; i++)
            points.push({ x: startPoint.x + i * dx, y: startPoint.y + i * dy })
        return points
    }

    static ErasePath(context, startPoint, endPoint, width) {
        let d = Erasor.DistanceBetweenTwoPoins(startPoint, endPoint)
        let p = Erasor.DivideIntoSegments(startPoint, endPoint, d / width)
        p = [startPoint, ...p, endPoint]
        p.forEach(pt => {
            context.clearRect(pt.x - width / 2, pt.y - width / 2, width, width)
        })
    }
}

class GalleryTile {
    constructor(name) {
        this.name = name
        this.scaleFactor = 0.1
        this.pointBuffer = {}

        this.canvas = document.createElement('canvas')
        let div = document.getElementById("gallery")
        this.canvas.width = 120
        this.canvas.height = 80
        this.canvas.classList.add("tile")
        this.canvas.title = name
        this.canvas.onclick = function () {
            window.location.href = "./" + name
        }
        div.appendChild(this.canvas)
    }

    draw(msg) {
        let context = this.canvas.getContext("2d")
        context.strokeStyle = msg.c
        if (msg.s) {
            if (msg.e) {
                this.pointBuffer = new Point(msg.x * this.scaleFactor, msg.y * this.scaleFactor)
            } else {
                context.beginPath()
                context.moveTo(msg.x * this.scaleFactor, msg.y * this.scaleFactor)
            }
        } else {
            if (msg.e) {
                Erasor.ErasePath(context, this.pointBuffer, new Point(msg.x * this.scaleFactor, msg.y * this.scaleFactor), msg.w * this.scaleFactor * 6)
                this.pointBuffer = new Point(msg.x * this.scaleFactor, msg.y * this.scaleFactor)
            } else {
                context.lineTo(msg.x * this.scaleFactor, msg.y * this.scaleFactor)
                context.lineWidth = msg.w * this.scaleFactor
                context.stroke()
            }
        }
    }
}

let chalkBoard = {
    socket: undefined,
    layers: {},
    myLayer: undefined,
    galleryTiles: {},
    footer: 120,

    initialize(board) {
        chalkBoard.connect(board)

        window.onresize = function () {

            let cs = Array.prototype.slice.call(document.getElementsByClassName('layer'))
            cs.forEach(canvas => {
                let ctx = canvas.getContext("2d")
                let temp = ctx.getImageData(0, 0, canvas.width, canvas.height)
                canvas.width = window.innerWidth
                canvas.height = window.innerHeight - chalkBoard.footer
                ctx.putImageData(temp, 0, 0)
            })
        }

        let sigCanvas = document.getElementById("sketchpad")
        sigCanvas.width = window.innerWidth
        sigCanvas.height = window.innerHeight - chalkBoard.footer
        let context = sigCanvas.getContext("2d")
        let is_touch_device = 'ontouchstart' in document.documentElement

        if (is_touch_device) {
            let drawer = {
                isDrawing: false,
                touchstart: function (coors) {
                    this.isDrawing = true
                    chalkBoard.send(coors.x, coors.y, this.isDrawing, true)
                },
                touchmove: function (coors) {
                    if (this.isDrawing) {
                        chalkBoard.send(coors.x, coors.y, this.isDrawing, false)
                    }
                },
                touchend: function (coors) {
                    if (this.isDrawing) {
                        this.touchmove(coors)
                        this.isDrawing = false
                        chalkBoard.send(coors.x, coors.y, this.isDrawing, false)
                    }
                }
            }
            function draw(event) {
                let coors = {
                    x: event.targetTouches[0].pageX,
                    y: event.targetTouches[0].pageY
                }
                let obj = sigCanvas

                if (obj.offsetParent) {
                    do {
                        coors.x -= obj.offsetLeft
                        coors.y -= obj.offsetTop
                    }
                    while ((obj = obj.offsetParent) != null)
                }
                drawer[event.type](coors)
            }
            sigCanvas.addEventListener('touchstart', draw, false)
            sigCanvas.addEventListener('touchmove', draw, false)
            sigCanvas.addEventListener('touchend', draw, false)
            sigCanvas.addEventListener('touchmove', function (event) {
                event.preventDefault()
            }, false)
        }
        else {
            $("#sketchpad").mousedown(function (mouseEvent) {
                let position = chalkBoard.getPosition(mouseEvent, sigCanvas)
                chalkBoard.send(position.X, position.Y, true, true)
                $(this).mousemove(function (mouseEvent) {
                    chalkBoard.drawLine(mouseEvent, sigCanvas, context, true)

                }).mouseup(function (mouseEvent) {
                    chalkBoard.finishDrawing(mouseEvent, sigCanvas, context)

                }).mouseout(function (mouseEvent) {
                    chalkBoard.finishDrawing(mouseEvent, sigCanvas, context)
                })
            })
        }
    },

    send: function (x, y, isDrawing, isStart) {
        chalkBoard.myLayer.send(chalkBoard.socket, x, y, isDrawing, isStart)
    },

    drawLine: function (mouseEvent, sigCanvas, context, drawing) {
        let position = chalkBoard.getPosition(mouseEvent, sigCanvas)
        chalkBoard.send(position.X, position.Y, drawing, false)
    },

    export: function () {
        let sigCanvas = document.getElementById("sketchpad")
        let context = sigCanvas.getContext("2d")
        let imageData = []
        for (const [key, value] of Object.entries(chalkBoard.layers)) {
            let canvas = value.canvas
            let ctx = canvas.getContext("2d")
            let temp = ctx.getImageData(0, 0, canvas.width, canvas.height)
            imageData.push(temp)
        }
        context.putImageData(chalkBoard.mergeImageData(imageData), 0, 0)
        let link = document.createElement('a')
        link.download = 'paintchat.png'
        link.href = sigCanvas.toDataURL()
        link.click()
        context.clearRect(0, 0, sigCanvas.width, sigCanvas.height)
    },

    mergeImageData: function (imageDataArray) {
        var newImageData = imageDataArray[0];
        for (var j = 0; j < imageDataArray.length; j++) {
            for (var i = 0, bytes = imageDataArray[j].data.length; i < bytes; i += 4) {
                var index = (imageDataArray[j].data[i + 3] === 0 ? 0 : j)
                newImageData.data[i] = imageDataArray[index].data[i]
                newImageData.data[i + 1] = imageDataArray[index].data[i + 1]
                newImageData.data[i + 2] = imageDataArray[index].data[i + 2]
                newImageData.data[i + 3] = imageDataArray[index].data[i + 3]
            }
        }
        return newImageData
    },

    finishDrawing: function (mouseEvent, sigCanvas, context) {
        chalkBoard.drawLine(mouseEvent, sigCanvas, context, false)
        $(sigCanvas).unbind("mousemove")
            .unbind("mouseup")
            .unbind("mouseout")
    },

    connect(board) {
        let url = `wss://${window.location.hostname}${location.port ? ':' + location.port : ''}/session/${board}`
        chalkBoard.socket = new WebSocket(url)
        chalkBoard.socket.onopen = function (evt) {
            console.log("Connected to Server", url)
        }
        chalkBoard.socket.onclose = function (evt) {
            console.log("Closed Connection")
            socket = null
        }
        chalkBoard.socket.onmessage = function (evt) {
            let msg = JSON.parse(evt.data)
            if (msg.b != "") {
                if (!chalkBoard.galleryTiles.hasOwnProperty(msg.b)) {
                    let tile = new GalleryTile(msg.b)
                    chalkBoard.galleryTiles[msg.b] = tile
                }
                chalkBoard.galleryTiles[msg.b].draw(msg)
                document.getElementById("gallerytitle").innerHTML = "other boards"
            } else {
                if (!chalkBoard.myLayer) {
                    let cpick = document.getElementById("colorpicker")
                    cpick.value = msg.c
                    chalkBoard.myLayer = chalkBoard.getOrCreateLayer(msg.n, msg.c, true)
                } else {
                    chalkBoard.drawPathInfo(msg)
                }
            }
        }
    },

    drawPathInfo(pinfo) {
        if (!chalkBoard.layers.hasOwnProperty(pinfo.n)) {
            chalkBoard.getOrCreateLayer(pinfo.n, pinfo.c, false)
        }
        chalkBoard.layers[pinfo.n].changeColor(pinfo.c)
        chalkBoard.layers[pinfo.n].drawPathInfo(pinfo)
    },

    getOrCreateLayer: function (id, color, mylayer) {
        if (chalkBoard.layers.hasOwnProperty(id)) {
            return chalkBoard.layers[id]
        }

        let canvas = document.createElement('canvas')
        let div = document.getElementById("canvasDiv")
        canvas.id = id
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight - chalkBoard.footer
        canvas.classList.add("layer")
        canvas.style.zIndex = mylayer ? -2 : -3
        canvas.style.position = "absolute"
        div.appendChild(canvas)

        let label = document.createElement('div')
        label.id = "label_" + id
        label.innerHTML = `<i class="fas fa-pen"></i> ${id}`
        label.className = "label"
        label.style.backgroundColor = color
        label.style.color = chalkBoard.invertColor(color, true)
        label.style.visibility = "hidden"

        div.appendChild(label)
        let layer = new Layer(id, color, canvas)
        chalkBoard.layers[id] = layer
        return layer
    },

    invertColor: function (hex, bw) {
        if (hex.indexOf('#') === 0) {
            hex = hex.slice(1)
        }
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
        }
        if (hex.length !== 6) {
            throw new Error('Invalid HEX color.')
        }
        let r = parseInt(hex.slice(0, 2), 16),
            g = parseInt(hex.slice(2, 4), 16),
            b = parseInt(hex.slice(4, 6), 16)
        if (bw) {
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186
                ? '#000000'
                : '#FFFFFF'
        }
        r = (255 - r).toString(16)
        g = (255 - g).toString(16)
        b = (255 - b).toString(16)
        return "#" + padZero(r) + padZero(g) + padZero(b)
    },

    getPosition: function (mouseEvent, sigCanvas) {
        let x, y
        if (mouseEvent.pageX != undefined && mouseEvent.pageY != undefined) {
            x = mouseEvent.pageX
            y = mouseEvent.pageY
        } else {
            x = mouseEvent.clientX + document.body.scrollLeft + document.documentElement.scrollLeft
            y = mouseEvent.clientY + document.body.scrollTop + document.documentElement.scrollTop
        }
        return { X: x - sigCanvas.offsetLeft, Y: y - sigCanvas.offsetTop }
    },

    copyTextToClipboard: function (text) {
        let textArea = document.createElement("textarea")
        textArea.style.position = 'fixed'
        textArea.style.top = 0
        textArea.style.left = 0
        textArea.style.width = '2em'
        textArea.style.height = '2em'
        textArea.style.padding = 0
        textArea.style.border = 'none'
        textArea.style.outline = 'none'
        textArea.style.boxShadow = 'none'
        textArea.style.background = 'transparent'
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()

        try {
            let successful = document.execCommand('copy')
            let msg = successful ? 'successful' : 'unsuccessful'
            console.log('Copying text command was ' + msg)
        } catch (err) {
            console.log('Oops, unable to copy')
        }

        document.body.removeChild(textArea)
    },

    copyLink: function () {
        chalkBoard.copyTextToClipboard(location.href)
    },

    code: function () {
        window.location.href = "https://github.com/moethu/paintchat"
    },

    cheers: function () {
        let title = prompt("Give your board a name", "")
        if (title != null) {
            if (title == "") { window.location.href = "./random" }
            else {
                window.location.href = title
            }
        }
    },

    changeColor: function (e) {
        chalkBoard.myLayer.changeColor(e.value)

    }
}
