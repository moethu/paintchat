package main

import (
	"encoding/json"
)

type message struct {
	data []byte
	room string
	name string
}

type subscription struct {
	conn *connection
	room string
}

type hub struct {
	rooms      map[string]map[*connection]bool
	broadcast  chan message
	register   chan subscription
	unregister chan subscription
}

var h = hub{
	broadcast:  make(chan message),
	register:   make(chan subscription),
	unregister: make(chan subscription),
	rooms:      make(map[string]map[*connection]bool),
}

func (h *hub) run() {
	for {
		select {
		case s := <-h.register:
			connections := h.rooms[s.room]
			if connections == nil {
				connections = make(map[*connection]bool)
				h.rooms[s.room] = connections
			}

			pinfo := pathinfo{Name: s.conn.layer.name, Color: s.conn.layer.color}
			bytemsg, err := json.Marshal(pinfo)
			if err == nil {
				s.conn.send <- bytemsg
			}

			for c := range connections {
				for _, pinfo := range c.history {
					bytemsg, err := json.Marshal(pinfo)
					if err == nil {
						s.conn.send <- bytemsg
					}
				}
			}
			h.rooms[s.room][s.conn] = true
		case s := <-h.unregister:
			connections := h.rooms[s.room]
			if connections != nil {
				if _, ok := connections[s.conn]; ok {
					delete(connections, s.conn)
					close(s.conn.send)
					if len(connections) == 0 {
						delete(h.rooms, s.room)
					}
				}
			}
		case m := <-h.broadcast:
			connections := h.rooms[m.room]
			for c := range connections {
				if c.layer.name != m.name {
					select {
					case c.send <- m.data:
					default:
						close(c.send)
						delete(connections, c)
						if len(connections) == 0 {
							delete(h.rooms, m.room)
						}
					}
				}
			}
		}
	}
}
