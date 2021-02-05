
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


class ChalkBoard {
    constructor(bname) {
        this.socket = null
        this.myname = ""
        this.mycolor = ""
        this.mythickness = 1
        this.pointBuffer = new Point(0, 0)
        this.offset = new Point(0, 0)
        this.boardSizeX = 2000
        this.boardSizeY = 1500
        this.panning = false
        this.erasing = false
        this.name = bname
        this.scale = 1
        this.messageBuffer = []

        this.board = document.getElementById("board")
        this.board.width = this.boardSizeX
        this.board.style.position = "absolute"
        this.board.height = this.boardSizeY
        this.board.classList.add("layer")
        this.board.style.zIndex = -3
        this.board.style["touch-action"] = "none"
        this.board.style.visibility = "hidden"
        this.board.style.display = "none"

        this.sketchpad = document.getElementById("sketchpad")
        this.sketchpad.width = window.innerWidth
        this.sketchpad.height = window.innerHeight

        this.connect(this.name)
        this.init()
    }

    resizeHandler() {
        window.onresize = function () {
            this.sketchpad.width = window.innerWidth
            this.sketchpad.height = window.innerHeight
            redraw()
        }
    }

    redraw() {
        let ctx = this.board.getContext("2d")
        let temp = ctx.getImageData(this.offset.x, this.offset.y, window.innerWidth / this.scale, window.innerHeight / this.scale)
        var newcanvas = $("<canvas>").attr("width", temp.width).attr("height", temp.height)[0]
        newcanvas.getContext("2d").putImageData(temp, 0, 0)

        let targetctx = this.sketchpad.getContext("2d")
        targetctx.clearRect(0, 0, window.innerWidth / this.scale, window.innerHeight / this.scale)
        targetctx.drawImage(newcanvas, 0, 0)
    }

    pan() {
        if (this.panning) {
            this.sketchpad.style.cursor = "auto"
            this.panning = false
            document.getElementById("pan").style.color = ""
        }
        else {
            this.sketchpad.style.cursor = "move"
            this.panning = true
            document.getElementById("pan").style.color = "#FCA311"
        }
    }

    connect(board) {
        let url = `wss://${window.location.hostname}${location.port ? ':' + location.port : ''}/session/${board}`
        this.socket = new WebSocket(url)
        this.socket.onopen = function (evt) {
            console.log("Connected to Server", url)
        }
        this.socket.onclose = function (evt) {
            console.log("Closed Connection")
            this.socket = null
        }
        this.socket.onmessage = function (evt) {
            let msg = JSON.parse(evt.data)
            if (msg.b == "") {
                if (!c.myname) {
                    let cpick = document.getElementById("colorpicker")
                    cpick.value = msg.c
                    c.myname = msg.n
                    c.mycolor = msg.c
                    console.log(msg.c)
                    c.createLabel(msg.n, msg.c)
                } else {
                    c.drawPathInfo(msg)
                    c.messageBuffer.push(msg)
                    if (!document.getElementById(`label_${msg.n}`)) {
                        c.createLabel(msg.n, msg.c)
                    }
                }
            }
        }
    }

    createLabel(id, color) {
        let label = document.createElement('div')
        label.id = "label_" + id
        label.innerHTML = `${id}`
        label.className = "label"
        label.style.backgroundColor = color
        label.style.color = this.invertColor(color, true)
        label.style.visibility = "hidden"
        document.getElementById(`canvasDiv`).appendChild(label)
    }

    moveLabel(name, x, y) {
        let d = document.getElementById(`label_${name}`)
        d.style.visibility = "visible"
        d.style.position = "absolute"
        d.style.left = (x - this.offset.x) * this.scale + 'px'
        d.style.top = (y - this.offset.y) * this.scale + 'px'
    }

    hideLabel(name) {
        let d = document.getElementById(`label_${name}`)
        d.style.visibility = "hidden"
    }

    invertColor(hex, bw) {
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
    }

    translate(x, y) {
        return new Point((x / this.scale + this.offset.x), (y / this.scale + this.offset.y))
    }

    drawPathInfo(msg) {
        let context = this.board.getContext("2d")
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
            this.moveLabel(msg.n, msg.x, msg.y)
            if (!msg.d) { this.hideLabel(msg.n) }
        }
        this.redraw()
    }

    send(x, y, isDrawing, isStart) {
        let p = this.translate(x, y)
        let path = new PathInfo(p.x, p.y, isDrawing, isStart, this.mythickness, this.mycolor, this.myname, this.erasing)
        this.drawPathInfo(path)
        if (this.socket) {
            this.socket.send(JSON.stringify(path))
        }
    }

    drawLine(mouseEvent, sigCanvas, context, drawing) {
        let position = this.getPosition(mouseEvent)
        this.send(position.X, position.Y, drawing, false)
    }

    finishDrawing(mouseEvent, sigCanvas, context) {
        if (mouseEvent.button == 2) {
            c.pan()
        }
        $("#sketchpad").unbind("mousemove")
            .unbind("mouseup")
            .unbind("mouseout")
    }

    getPosition(mouseEvent) {
        let x, y
        if (mouseEvent.pageX != undefined && mouseEvent.pageY != undefined) {
            x = mouseEvent.pageX
            y = mouseEvent.pageY
        } else {
            x = mouseEvent.clientX + document.body.scrollLeft + document.documentElement.scrollLeft
            y = mouseEvent.clientY + document.body.scrollTop + document.documentElement.scrollTop
        }
        return { X: x - this.sketchpad.offsetLeft, Y: y - this.sketchpad.offsetTop }
    }

    init() {
        this.sketchpad.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; })
        this.sketchpad.addEventListener('wheel', function (e) {
            var mousex = e.clientX - c.offset.x;
            var mousey = e.clientY - c.offset.y;
            var wheel = e.deltaY / 60;//n or -n
            var zoom = 1 + wheel / 2;
            let context = c.sketchpad.getContext("2d")
            context.scale(zoom, zoom);
            c.offset.x = (mousex / c.scale + c.offset.x - mousex / (c.scale * zoom))
            c.offset.y = (mousey / c.scale + c.offset.y - mousey / (c.scale * zoom))
            c.scale *= zoom
            c.redraw()
        })

        let context = this.sketchpad.getContext("2d")
        let is_touch_device = 'ontouchstart' in document.documentElement

        if (is_touch_device) {
            let drawer = {
                isDrawing: false,
                touchstart: function (coors) {
                    if (coors.t == 1) {
                        this.isDrawing = true
                        if (!c.panning) {
                            c.send(coors.x, coors.y, this.isDrawing, true)
                        } else {
                            c.pointBuffer = new Point(coors.x, coors.y)
                        }
                    }
                },
                touchmove: function (coors) {

                    if (this.isDrawing) {
                        if (!c.panning) {
                            c.send(coors.x, coors.y, this.isDrawing, false)
                        }
                        else {
                            if (coors.t == 1) {
                                let x = c.pointBuffer.x - coors.x
                                let y = c.pointBuffer.y - coors.y
                                c.offset.x += x
                                c.offset.y += y
                                c.redraw()
                                c.pointBuffer = new Point(coors.x, coors.y)
                            }
                            else if (coors.t == 2) {
                                let context = c.sketchpad.getContext("2d")
                                let f = coors.s > 1.0 ? 1 : -1
                                let zoom = (1 * f) + (coors.s / 60) / 2
                                context.scale(zoom, zoom)
                                c.offset.x = (coors.x / c.scale + c.offset.x - coors.x / (c.scale * zoom))
                                c.offset.y = (coors.y / c.scale + c.offset.y - coors.y / (c.scale * zoom))
                                c.scale *= zoom
                                c.redraw()
                            }
                        }
                    }
                },
                touchend: function (coors) {
                    if (coors.t == 1) {
                        if (this.isDrawing) {
                            this.touchmove(coors)
                            this.isDrawing = false
                            if (!c.panning) {
                                c.send(coors.x, coors.y, this.isDrawing, false)
                            }
                        }
                    }
                },

            }
            function draw(event) {
                event.preventDefault()
                event.stopPropagation()
                let coors = {
                    x: event.targetTouches[0].pageX,
                    y: event.targetTouches[0].pageY,
                    s: event.scale,
                    t: event.targetTouches.length
                }
                if (coors.t == 2) {
                    let dx = event.targetTouches[1].pageX - coors.x
                    let dy = event.targetTouches[1].pageY - coors.y
                    coors.x = event.targetTouches[0].pageX + dx
                    coors.y = event.targetTouches[0].pageY + dy
                }
                let obj = c.sketchpad

                if (obj.offsetParent) {
                    do {
                        coors.x -= obj.offsetLeft
                        coors.y -= obj.offsetTop
                    }
                    while ((obj = obj.offsetParent) != null)
                }
                drawer[event.type](coors)
            }

            this.sketchpad.addEventListener('touchstart', draw, false)
            this.sketchpad.addEventListener('touchmove', draw, false)
            this.sketchpad.addEventListener('touchend', draw, false)
        }
        else {
            $("#sketchpad").mousedown(function (mouseEvent) {
                if (mouseEvent.button == 2) {
                    c.pan()
                }

                let position = c.getPosition(mouseEvent)
                if (!c.panning) {
                    c.send(position.X, position.Y, true, true)
                } else {
                    c.pointBuffer = new Point(mouseEvent.clientX, mouseEvent.clientY)
                }

                $(this).mousemove(function (mouseEvent) {

                    if (!c.panning) {
                        c.drawLine(mouseEvent, c.sketchpad, context, true)
                    } else {
                        let x = c.pointBuffer.x - mouseEvent.clientX
                        let y = c.pointBuffer.y - mouseEvent.clientY
                        c.offset.x += x
                        c.offset.y += y
                        c.redraw()
                        c.pointBuffer = new Point(mouseEvent.clientX, mouseEvent.clientY)
                    }

                }).mouseup(function (mouseEvent) {
                    if (!c.panning) {
                        c.drawLine(mouseEvent, c.sketchpad, context, false)
                    }
                    c.finishDrawing(mouseEvent, c.sketchpad, context)
                }).mouseout(function (mouseEvent) {
                    if (!c.panning) { c.drawLine(mouseEvent, c.sketchpad, context, false) }
                    c.finishDrawing(mouseEvent, c.sketchpad, context)
                })
            })
        }
    }

    setThickness(t) { this.mythickness = t }

    copyTextToClipboard(text) {
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
    }

    copyLink() {
        this.copyTextToClipboard(location.href)
    }

    erase() {
        if (this.erasing == true) {
            this.erasing = false
            document.getElementById("erase").style.color = ""
        }
        else {
            document.getElementById("erase").style.color = "#FCA311"
            this.erasing = true
        }
    }

    code() {
        window.location.href = "https://github.com/moethu/paintchat"
    }

    cheers() {
        let title = prompt("Give your new board a name.\nWant to make it private - add private to the name.", "")
        if (title != null) {
            if (title == "") { window.location.href = "./random" }
            else {
                window.location.href = title
            }
        }
    }

    changeColor(e) {
        this.mycolor = e.value
    }

    export() {
        let link = document.createElement('a')
        link.download = 'paintchat.png'
        link.href = this.board.toDataURL()
        link.click()
    }
}
