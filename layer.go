package main

import (
	"github.com/AvraamMavridis/randomcolor"
	"github.com/moethu/go-randomdata"
)

type layer struct {
	name  string `json:"name"`
	color string `json:"color"`
	paths []path `json:"path"`
}

type path struct {
	points []point `json:"point"`
	width  int     `json:"width"`
}

type point struct {
	x int `json:"x"`
	y int `json:"y"`
}

type pathinfo struct {
	Name    string `json:"n"`
	Color   string `json:"c"`
	Width   int    `json:"w"`
	Path    int    `json:"p"`
	Drawing bool   `json:"d"`
	Start   bool   `json:"s"`
	X       int    `json:"x"`
	Y       int    `json:"y"`
	Erase   bool   `json:"e"`
}

func NewLayer() layer {
	layer := layer{
		name:  randomdata.FirstName(randomdata.Female),
		color: randomcolor.GetRandomColorInHex(),
		paths: []path{},
	}
	return layer
}

func (l *layer) AddPath() {
	p := path{
		width:  2,
		points: []point{},
	}
	l.paths = append(l.paths, p)
}

func (p *path) AddPoint(x int, y int) {
	pt := point{x: x, y: y}
	p.points = append(p.points, pt)
}
