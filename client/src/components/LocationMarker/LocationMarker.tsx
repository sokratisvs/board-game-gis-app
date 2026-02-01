import { Icon, LatLngExpression } from 'leaflet'
import { ReactNode } from 'react'
import { Circle, Marker, Popup } from 'react-leaflet'

import redMarkerIconUrl from '../../assets/icons/red-marker-icon.png'
import markerIconUrl from '../../assets/icons/marker-icon.png'
import questionMarkIconUrl from '../../assets/icons/question-mark-icon.png'

export default function MarkerComponent(props: {
  position: LatLngExpression
  type: string
  name?: string
  children?: ReactNode
}) {
  const { type, position } = props || {}

  const myLocationIcon = new Icon({
    className: 'marker',
    iconUrl: redMarkerIconUrl,
    iconSize: [38, 38],
  })

  const pointIcon = new Icon({
    className: 'marker',
    iconUrl: markerIconUrl,
    iconSize: [28, 28],
  })
  const questionIcon = new Icon({
    className: 'marker',
    iconUrl: questionMarkIconUrl,
    iconSize: [40, 40],
  })

  const renderIcon = (type: string) => {
    switch (type) {
      case 'myLocation':
        return (
          <Marker position={props.position} icon={myLocationIcon}>
            <Popup>{props?.name}</Popup>
          </Marker>
        )
      case 'user':
        return (
          <Circle center={position} color="blue" fillColor="blue" radius={200}>
            <Popup>{props?.name}</Popup>
          </Circle>
        )
      case 'shop':
        return (
          <Marker position={props.position} icon={pointIcon}>
            <Popup>{props?.name}</Popup>
          </Marker>
        )
      default:
        return (
          <Marker position={props.position} icon={questionIcon}>
            <Popup>{props?.name}</Popup>
          </Marker>
        )
    }
  }

  return <div>{props.type && props.position && renderIcon(type)}</div>
}
