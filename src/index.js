'use strict';

import L from 'leaflet';
import PouchDB from 'pouchdb-browser';
import * as OfflinePluginRuntime from 'offline-plugin/runtime';

require('./assets/css/styles.css');

OfflinePluginRuntime.install({
  onUpdating: () => {
    console.log('SW Event:', 'onUpdating');
  },
  onUpdateReady: () => {
    console.log('SW Event:', 'onUpdateReady');
    // Tells to new SW to take control immediately
    runtime.applyUpdate();
  },
  onUpdated: () => {
    console.log('SW Event:', 'onUpdated');
    // Reload the webpage to load into the new version
    window.location.reload();
  },

  onUpdateFailed: () => {
    console.log('SW Event:', 'onUpdateFailed');
  }
});

const Elm = require('./Main');

window.PouchDB = PouchDB;
let db = new PouchDB('ephemeral');

let mymap = L.map('mapid').setView([60.1719, 24.9414], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mymap);

let root = document.getElementById('root');
let app = Elm.Main.embed(root);

// -- Port Subscriptions --
let center;
let markers = {};

mymap.on('move', (evt) => {
  center = mymap.getCenter();
  app.ports.getCenter.send([center.lat, center.lng])
})

app.ports.setView.subscribe((data) => {
    mymap.setView.apply(mymap, data);
});

app.ports.setMarkers.subscribe((data) => {
    data.forEach((data, index) => {
      let [id, latLng, markerOptions, popupText] = data;

      markerOptions.icon = new L.Icon(markerOptions.icon)
      let marker = L.marker(latLng, markerOptions);

      marker.bindPopup(popupText);

      if(!markers.hasOwnProperty(id)){
        marker.addTo(mymap);
      }
      markers[id] = marker;
    })
});

app.ports.saveEntry.subscribe((data) => {
  console.log("Got entry to create", data);
  let meta = {"type": "entry"};
  let doc = Object.assign(data, meta);
  console.log(doc);
  db.post(doc);
});

app.ports.updateEntry.subscribe((data) => {
  console.log("Got entry to update", data);

  let {_id} = data;
  console.log(_id);

  db.get(_id).then((doc) => {
    // NOTE: We disregard the _rev from Elm, to be safe
    let {_rev} = doc;

    let newDoc = Object.assign(doc, data);
    newDoc._rev = _rev;

    return db.put(newDoc);
  }).then((res) => {
    console.log("Successfully updated", res);
    // TODO: Send back over port that Ok entryToDecode
  }).catch((err) =>{
    console.log("Failed to update", err);
    // TODO: Send back over port that Err error
  });

});

app.ports.listEntries.subscribe((str) => {
  console.log("Will list entries");
  let docs = db.allDocs({include_docs: true})
    .then(docs => {
      let entries = docs.rows.map(row => row.doc);
      console.log("Listing entries", entries);

      app.ports.getEntries.send(entries);
    });
});
