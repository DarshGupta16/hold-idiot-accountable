/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_503512333")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "json1191102054",
    "maxSize": 0,
    "name": "timeline",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3458754147",
    "max": 0,
    "min": 0,
    "name": "summary",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_503512333")

  // remove field
  collection.fields.removeById("json1191102054")

  // remove field
  collection.fields.removeById("text3458754147")

  return app.save(collection)
})
