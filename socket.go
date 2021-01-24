package main

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/moethu/go-randomdata"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type connection struct {
	ws      *websocket.Conn
	layer   layer
	send    chan []byte
	history []pathinfo
}

func (s subscription) readPump() {
	c := s.conn
	defer func() {
		h.unregister <- s
		c.ws.Close()
	}()
	c.ws.SetReadLimit(maxMessageSize)
	c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error { c.ws.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, msg, err := c.ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Printf("error: %v", err)
			}
			break
		}

		var pinfo pathinfo
		if err := json.Unmarshal(msg, &pinfo); err == nil {
			pinfo.Color = c.layer.color
			pinfo.Name = c.layer.name
			c.history = append(c.history, pinfo)
			bytemsg, err := json.Marshal(pinfo)
			if err == nil {
				m := message{bytemsg, s.room}
				h.broadcast <- m
			}
		}
	}
}

func (c *connection) write(mt int, payload []byte) error {
	c.ws.SetWriteDeadline(time.Now().Add(writeWait))
	return c.ws.WriteMessage(mt, payload)
}

func (s *subscription) writePump() {
	c := s.conn
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.ws.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.write(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.write(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.write(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}

func ServeWebsocket(c *gin.Context) {
	sessionid := strings.ToLower(c.Params.ByName("sessionid"))
	if sessionid == "" {
		sessionid = strings.ToLower(randomdata.City())
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	conn.EnableWriteCompression(true)

	client := &connection{ws: conn, send: make(chan []byte, 256)}
	client.layer = NewLayer()
	s := subscription{client, sessionid}
	h.register <- s

	go s.writePump()
	go s.readPump()
}
