import { Icon, LatLngExpression } from 'leaflet';
import { ReactNode } from 'react';
import { Circle, Marker, Popup } from 'react-leaflet';

export default function MarkerComponent(props: {
  position: LatLngExpression,
  type: string,
  popUp?: string,
  children?: ReactNode;
}) {

  const { type, position } = props || {}

  const myLocationIcon = new Icon({
    className: 'marker',
    iconUrl: require('../../assets/icons/red-marker-icon.png'),
    iconSize: [38, 38]
   })

  const pointIcon = new Icon({
    className: 'marker',
    iconUrl: require('../../assets/icons/marker-icon.png'),
    iconSize: [28, 28]
   })
   const questionIcon = new Icon({
    className: 'marker',
    iconUrl: require('../../assets/icons/question-mark-icon.png'),
    iconSize: [40, 40]
   })

   const renderIcon = (type: string, position: LatLngExpression) => {
    switch(type) {
      case 'myLocation':
        return (        
        <Marker 
          position={props.position} 
          icon={myLocationIcon}>
            <Popup>
              {props?.popUp}
            </Popup>
        </Marker>)
      case 'user':
        return (
          <Circle
          center={position}
          color="blue"
          fillColor="blue"
          radius={200}>
            <Popup>
              {props?.popUp}
            </Popup>
          </Circle>)
      case 'shop':
        return (        
        <Marker 
          position={props.position} 
          icon={pointIcon}>
            <Popup>
              {props?.popUp}
            </Popup>
        </Marker>)
        default:
          return (        
            <Marker 
              position={props.position} 
              icon={questionIcon}>
                <Popup>
                  {props?.popUp}
                </Popup>
            </Marker>)
    }
   }

  return (
    <div>
      {props.type && props.position && renderIcon(type, position)}
    </div>
  )
}
