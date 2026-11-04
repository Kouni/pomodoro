// Focus (or open) the app when one of its notifications is clicked.
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) =>
                clients.length > 0
                    ? clients[0].focus()
                    : self.clients.openWindow("/")
            )
    );
});
