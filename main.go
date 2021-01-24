package main

import (
	"context"
	"flag"
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
	"github.com/thinkerou/favicon"
)

func main() {
	go h.run()

	flag.Parse()
	log.SetFlags(0)

	router := gin.Default()
	port := ":80"
	srv := &http.Server{
		Addr:         port,
		Handler:      router,
		ReadTimeout:  600 * time.Second,
		WriteTimeout: 600 * time.Second,
	}

	router.Use(favicon.New("./static/favicon.ico"))
	router.Any("/session/:sessionid", ServeWebsocket)
	router.Static("/static/", "./static/")
	router.GET("/", home)
	router.GET("/board/:sessionid", board)

	log.Println("Starting HTTP Server on Port", port)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
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
	sessionid := randomdata.City()
	c.Redirect(307, "./board/"+sessionid)
}

func board(c *gin.Context) {
	sessionid := strings.ToLower(c.Params.ByName("sessionid"))
	viewertemplate := template.Must(template.ParseFiles("templates/sketchboard.html"))
	viewertemplate.Execute(c.Writer, sessionid)
}
