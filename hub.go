package main

import (
	"encoding/json"
	"sort"
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

func (h *hub) getMostPopular(currentRoom string, length int) []string {
	names := make([]string, 0, len(h.rooms))

	for room := range h.rooms {
		if room != currentRoom {
			names = append(names, room)
		}
	}

	sort.Slice(names, func(i, j int) bool {
		return len(h.rooms[names[i]]) > len(h.rooms[names[j]])
	})

	if len(names) < length {
		return names
	} else {
		return names[:length]
	}
}

func (h *hub) run() {
	for {
		select {
		case s := <-h.register:

			for _, room := range h.getMostPopular(s.room, 4) {
				connections := h.rooms[room]
				for c := range connections {
					for _, pinfo := range c.history {
						pinfo.Board = room
						bytemsg, err := json.Marshal(pinfo)
						if err == nil {
							s.conn.send <- bytemsg
						}
					}
				}
			}

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
