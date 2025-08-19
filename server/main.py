#!/usr/bin/env python3
"""
Real-time WebRTC Object Detection Server
Handles WebRTC connections and runs inference on received video frames
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional
import cv2
import numpy as np
import onnxruntime as ort
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaPlayer
import websockets
from websockets.server import serve
import argparse
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ObjectDetector:
    def __init__(self, model_path: str, input_size: int = 320):
        self.input_size = input_size
        self.session = ort.InferenceSession(model_path)
        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [output.name for output in self.session.get_outputs()]
        # Log model input/output metadata for debugging
        try:
            logger.info(f"Model input name: {self.input_name}")
            out_meta = [(o.name, tuple(o.shape)) for o in self.session.get_outputs()]
            logger.info(f"Model outputs: {out_meta}")
        except Exception:
            logger.debug("Could not read model metadata")

        # COCO class names
        self.class_names = [
            "person",
            "bicycle",
            "car",
            "motorcycle",
            "airplane",
            "bus",
            "train",
            "truck",
            "boat",
            "traffic light",
            "fire hydrant",
            "stop sign",
            "parking meter",
            "bench",
            "bird",
            "cat",
            "dog",
            "horse",
            "sheep",
            "cow",
            "elephant",
            "bear",
            "zebra",
            "giraffe",
            "backpack",
            "umbrella",
            "handbag",
            "tie",
            "suitcase",
            "frisbee",
            "skis",
            "snowboard",
            "sports ball",
            "kite",
            "baseball bat",
            "baseball glove",
            "skateboard",
            "surfboard",
            "tennis racket",
            "bottle",
            "wine glass",
            "cup",
            "fork",
            "knife",
            "spoon",
            "bowl",
            "banana",
            "apple",
            "sandwich",
            "orange",
            "broccoli",
            "carrot",
            "hot dog",
            "pizza",
            "donut",
            "cake",
            "chair",
            "couch",
            "potted plant",
            "bed",
            "dining table",
            "toilet",
            "tv",
            "laptop",
            "mouse",
            "remote",
            "keyboard",
            "cell phone",
            "microwave",
            "oven",
            "toaster",
            "sink",
            "refrigerator",
            "book",
            "clock",
            "vase",
            "scissors",
            "teddy bear",
            "hair drier",
            "toothbrush",
        ]

    def preprocess(self, frame: np.ndarray) -> np.ndarray:
        """Preprocess frame for YOLO inference"""
        # Resize to input size
        resized = cv2.resize(frame, (self.input_size, self.input_size))

        # Convert BGR to RGB
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

        # Normalize to [0, 1]
        normalized = rgb.astype(np.float32) / 255.0

        # Transpose to CHW format and add batch dimension
        input_tensor = np.transpose(normalized, (2, 0, 1))[np.newaxis, ...]

        return input_tensor

    def postprocess(
        self, outputs: List[np.ndarray], conf_threshold: float = 0.5
    ) -> List[Dict]:
        """Postprocess YOLO outputs to detection format"""
        detections = []

        # Flexible postprocessing: try to recognize common output formats
        try:
            out0 = outputs[0]
            logger.debug(f"Postprocess: output[0] shape: {out0.shape}")

            # YOLOv5 style: [batch, num_detections, 85]
            if out0.ndim == 3 and out0.shape[2] >= 6:
                preds = out0[0]
                logger.debug(
                    f"Interpreting output as YOLO-style with {preds.shape[0]} predictions"
                )
                for pred in preds:
                    x_center, y_center, width, height = pred[:4]
                    confidence = float(pred[4])
                    class_scores = pred[5:]

                    if confidence <= conf_threshold:
                        continue

                    class_id = (
                        int(np.argmax(class_scores)) if class_scores.size > 0 else 0
                    )
                    class_score = (
                        float(class_scores[class_id]) if class_scores.size > 0 else 1.0
                    )

                    if class_score <= conf_threshold:
                        continue

                    xmin = max(0, (x_center - width / 2) / self.input_size)
                    ymin = max(0, (y_center - height / 2) / self.input_size)
                    xmax = min(1, (x_center + width / 2) / self.input_size)
                    ymax = min(1, (y_center + height / 2) / self.input_size)

                    detections.append(
                        {
                            "label": (
                                self.class_names[class_id]
                                if class_id < len(self.class_names)
                                else "unknown"
                            ),
                            "score": float(confidence * class_score),
                            "xmin": float(xmin),
                            "ymin": float(ymin),
                            "xmax": float(xmax),
                            "ymax": float(ymax),
                        }
                    )
                return detections

            # SSD-style: sometimes outputs as [1, 1, N, 7] where last dim is [batch_id, class, conf, xmin, ymin, xmax, ymax]
            if out0.ndim == 4 and out0.shape[2] == 1 and out0.shape[3] >= 7:
                pred_box = out0[0][0]
                logger.debug(
                    f"Interpreting output as SSD-style with {pred_box.shape[0]} predictions"
                )
                for row in pred_box:
                    # Depending on export, columns may vary; try common ordering
                    # Some implementations: [batch_id, class, score, xmin, ymin, xmax, ymax]
                    try:
                        class_id = int(row[1])
                        score = float(row[2])
                        xmin = float(row[3])
                        ymin = float(row[4])
                        xmax = float(row[5])
                        ymax = float(row[6])
                    except Exception:
                        continue

                    if score <= conf_threshold:
                        continue

                    detections.append(
                        {
                            "label": (
                                self.class_names[class_id]
                                if class_id < len(self.class_names)
                                else "unknown"
                            ),
                            "score": float(score),
                            "xmin": float(xmin),
                            "ymin": float(ymin),
                            "xmax": float(xmax),
                            "ymax": float(ymax),
                        }
                    )
                return detections

            # Fallback: try flattened [num*6] as [x,y,w,h,conf,class]
            flat = out0.flatten()
            if flat.size % 6 == 0:
                num = flat.size // 6
                for i in range(num):
                    off = i * 6
                    x = float(flat[off])
                    y = float(flat[off + 1])
                    w = float(flat[off + 2])
                    h = float(flat[off + 3])
                    conf = float(flat[off + 4])
                    cls = int(flat[off + 5])
                    if conf <= conf_threshold:
                        continue
                    xmin = max(0, x - w / 2)
                    ymin = max(0, y - h / 2)
                    xmax = min(1, x + w / 2)
                    ymax = min(1, y + h / 2)
                    detections.append(
                        {
                            "label": (
                                self.class_names[cls]
                                if cls < len(self.class_names)
                                else "unknown"
                            ),
                            "score": conf,
                            "xmin": float(xmin),
                            "ymin": float(ymin),
                            "xmax": float(xmax),
                            "ymax": float(ymax),
                        }
                    )
                return detections

        except Exception as e:
            logger.exception(f"Error in postprocess: {e}")

        # If nothing matched, return empty
        return detections

    def detect(self, frame: np.ndarray) -> List[Dict]:
        """Run object detection on a frame"""
        start_time = time.time()

        # Preprocess
        input_tensor = self.preprocess(frame)

        # Run inference
        outputs = self.session.run(self.output_names, {self.input_name: input_tensor})

        # Postprocess
        detections = self.postprocess(outputs)

        inference_time = (time.time() - start_time) * 1000
        logger.debug(
            f"Inference time: {inference_time:.2f}ms, Detections: {len(detections)}"
        )

        return detections


class VideoProcessor:
    def __init__(self, detector: ObjectDetector):
        self.detector = detector
        self.frame_queue = asyncio.Queue(maxsize=5)  # Backpressure control
        self.processing = False

    async def process_frame(
        self, frame: np.ndarray, frame_id: str, capture_ts: int
    ) -> Dict:
        """Process a single frame and return detection results"""
        recv_ts = int(time.time() * 1000)

        # Run detection
        detections = self.detector.detect(frame)

        inference_ts = int(time.time() * 1000)

        return {
            "frame_id": frame_id,
            "capture_ts": capture_ts,
            "recv_ts": recv_ts,
            "inference_ts": inference_ts,
            "detections": detections,
        }


class WebRTCServer:
    def __init__(self, detector: ObjectDetector):
        self.detector = detector
        self.processor = VideoProcessor(detector)
        self.peer_connections = {}
        self.websocket_connections = {}

    async def handle_websocket(self, websocket, path):
        """Handle WebSocket connections for signaling"""
        connection_id = id(websocket)
        self.websocket_connections[connection_id] = websocket

        logger.info(f"WebSocket connected: {connection_id}")

        try:
            async for message in websocket:
                await self.handle_message(websocket, json.loads(message))
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket disconnected: {connection_id}")
        finally:
            if connection_id in self.websocket_connections:
                del self.websocket_connections[connection_id]
            if connection_id in self.peer_connections:
                await self.peer_connections[connection_id].close()
                del self.peer_connections[connection_id]

    async def handle_message(self, websocket, message):
        """Handle incoming WebSocket messages"""
        msg_type = message.get("type")
        payload = message.get("payload")

        if msg_type == "offer":
            await self.handle_offer(websocket, payload)
        elif msg_type == "answer":
            await self.handle_answer(websocket, payload)
        elif msg_type == "ice_candidate":
            await self.handle_ice_candidate(websocket, payload)
        elif msg_type == "start_receiving":
            mode = message.get("mode", "server")
            await self.start_receiving(websocket, mode)

    async def handle_offer(self, websocket, offer):
        """Handle WebRTC offer from phone"""
        connection_id = id(websocket)

        # Create peer connection
        pc = RTCPeerConnection()
        self.peer_connections[connection_id] = pc

        @pc.on("track")
        async def on_track(track):
            logger.info(f"Received track: {track.kind}")
            if track.kind == "video":
                await self.process_video_track(websocket, track)

        @pc.on("icecandidate")
        async def on_icecandidate(candidate):
            if candidate:
                await websocket.send(
                    json.dumps(
                        {
                            "type": "ice_candidate",
                            "payload": {
                                "candidate": candidate.candidate,
                                "sdpMid": candidate.sdpMid,
                                "sdpMLineIndex": candidate.sdpMLineIndex,
                            },
                        }
                    )
                )

        # Set remote description
        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
        )

        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # Send answer
        await websocket.send(
            json.dumps(
                {
                    "type": "answer",
                    "payload": {
                        "sdp": pc.localDescription.sdp,
                        "type": pc.localDescription.type,
                    },
                }
            )
        )

    async def handle_answer(self, websocket, answer):
        """Handle WebRTC answer"""
        connection_id = id(websocket)
        if connection_id in self.peer_connections:
            pc = self.peer_connections[connection_id]
            await pc.setRemoteDescription(
                RTCSessionDescription(sdp=answer["sdp"], type=answer["type"])
            )

    async def handle_ice_candidate(self, websocket, candidate):
        """Handle ICE candidate"""
        connection_id = id(websocket)
        if connection_id in self.peer_connections:
            pc = self.peer_connections[connection_id]
            await pc.addIceCandidate(candidate)

    async def start_receiving(self, websocket, mode):
        """Start receiving video from phone"""
        logger.info(f"Starting to receive video in {mode} mode")
        # This would be handled by the offer/answer flow

    async def process_video_track(self, websocket, track):
        """Process incoming video track"""
        frame_count = 0

        while True:
            try:
                frame = await track.recv()
                frame_count += 1

                # Convert frame to numpy array
                img = frame.to_ndarray(format="bgr24")

                # Process every nth frame to control FPS
                if (
                    frame_count % 2 == 0
                ):  # Process every 2nd frame (~15 FPS from 30 FPS)
                    frame_id = str(frame_count)
                    capture_ts = int(time.time() * 1000)

                    # Process frame
                    result = await self.processor.process_frame(
                        img, frame_id, capture_ts
                    )

                    # Send result back
                    await websocket.send(
                        json.dumps({"type": "detection_result", "payload": result})
                    )

            except Exception as e:
                logger.error(f"Error processing video frame: {e}")
                break


async def main():
    parser = argparse.ArgumentParser(description="WebRTC Object Detection Server")
    parser.add_argument(
        "--model", default="models/yolov5n.onnx", help="Path to ONNX model"
    )
    parser.add_argument("--host", default="localhost", help="Host to bind to")
    parser.add_argument("--port", default=8765, type=int, help="Port to bind to")
    parser.add_argument("--input-size", default=320, type=int, help="Model input size")

    args = parser.parse_args()

    # Initialize detector
    if not os.path.exists(args.model):
        logger.error(f"Model file not found: {args.model}")
        return

    detector = ObjectDetector(args.model, args.input_size)
    logger.info(f"Loaded model: {args.model}")

    # Initialize server
    server = WebRTCServer(detector)

    # Start WebSocket server
    logger.info(f"Starting WebRTC server on {args.host}:{args.port}")
    async with serve(server.handle_websocket, args.host, args.port):
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(main())
