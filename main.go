package main

import (
	"context"
	"flag"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/moethu/go-randomdata"
	stats "github.com/semihalev/gin-stats"
	"github.com/thinkerou/favicon"
)

func main() {
	go h.run()

	flag.Parse()
	log.SetFlags(0)

	devenv := true
	port := ":8085"
	if os.Getenv("DEV") == "" {
		devenv = false
		port = ":443"
	}

	router := gin.Default()

	srv := &http.Server{
		Addr:         port,
		Handler:      router,
		ReadTimeout:  600 * time.Second,
		WriteTimeout: 600 * time.Second,
	}

	router.Use(stats.RequestStats())

	router.GET("/stats", func(c *gin.Context) {
		c.JSON(http.StatusOK, stats.Report())
	})
	router.Use(favicon.New("./static/favicon.ico"))
	router.Any("/session/:sessionid", ServeWebsocket)
	router.Static("/static/", "./static/")
	router.GET("/", home)
	router.GET("/boards", boards)
	router.GET("/board/:sessionid", board)

	log.Println("Starting HTTP Server on Port", port)

	go func() {
		if devenv {
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatalf("listen: %s\n", err)
			}
		} else {
			if err := srv.ListenAndServeTLS("../paint-chat.com_ssl_certificate.cer", "../_.paint-chat.com_private_key.key"); err != nil && err != http.ErrServerClosed {
				log.Fatalf("listen: %s\n", err)
			}
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown Server")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server Shutdown: ", err)
	}
	log.Println("Server exiting")
}

func home(c *gin.Context) {
	c.Redirect(307, "./board/hello%20world")
}

func board(c *gin.Context) {
	sessionid := strings.ToLower(c.Params.ByName("sessionid"))
	if sessionid == "" || sessionid == "random" {
		sessionid = randomdata.City()
		c.Redirect(307, "./"+sessionid)
		return
	}
	viewertemplate := template.Must(template.ParseFiles("templates/sketchboard.html"))
	viewertemplate.Execute(c.Writer, sessionid)
}

func boards(c *gin.Context) {
	var rooms []string
	for room := range h.rooms {
		connections := h.rooms[room]
		rooms = append(rooms, fmt.Sprintf("%s (%d)", room, len(connections)))
	}
	c.JSON(200, rooms)
}
