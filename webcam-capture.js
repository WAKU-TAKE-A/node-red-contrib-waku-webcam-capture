const { exec } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
let child = null;

module.exports = function (RED) {
  function WebcamCaptureNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.on('input', async (msg, send, done) => {
      if (child) {
        if (msg.forceStop)
        {
          child.kill('SIGTERM');
          return done(); 
        }
        msg.error = {
          "code": null,
          "signal": null,
          "message": 'Err: Process is running.'
        };
        msg.payload = null;
        send(msg);
        return done(); 
      } else {
        msg.error = null;
      }

      if (!msg.inputDevice) {
        msg.error = {
          "code": null,
          "signal": null,
          "message": 'Err: msg.inputDevice is null.'
        };
        msg.payload = null;
        send(msg);
        return done();  
      }

      const inputDevice = msg.inputDevice || '';
      const width = msg.width || 640;
      const height = msg.height || 480;
      const outputFormat = msg.outputFormat || 'jpg';
      msg.inputDevice = inputDevice;
      msg.width = width;
      msg.height = height;
      msg.outputFormat = outputFormat;

      if (!['jpg', 'png', 'bmp', 'tiff'].includes(outputFormat)) {
        msg.error = {
          "code": null,
          "signal": null,
          "message": 'Err: msg.outputFormat must be "jpg", "png", "bmp", or "tiff".'
        };
        msg.payload = null;
        send(msg);
        return done();
      }

      const outputFile = path.join(__dirname, `output/output_image.${outputFormat}`);
      msg.outputFile = outputFile;
      const ffmpegArgs = [
        '-f', 'video4linux2', // Linux-specific input format[0][1]
        '-i', inputDevice, // Input device[2][3]
        '-s', `${width}x${height}`, // Resolution[4][5]
        '-frames:v', '1', // Single frame[6][7]
        '-y', '"' + outputFile + '"' //overwrite output files[8][9]
      ];

      // Cross-platform adjustments
      if (process.platform === 'win32') {
        ffmpegArgs[1] = 'dshow'; // Use DirectShow for Windows
        ffmpegArgs[3] = 'video="' + inputDevice + '"';
      } else if (process.platform === 'darwin') {
        ffmpegArgs[1] = 'avfoundation'; // Use AVFoundation for MacOS
        ffmpegArgs[3] = '"' + inputDevice + '"';
      }

      const command = `"${ffmpegPath}" ${ffmpegArgs.join(' ')}`;
      msg.ffmpegCommand = command;

      child = exec(command, (error, stdout, stderr) => {
        if (error) {
          msg.error = {
            "code":error.code || null,
            "signal":error.signal || null,
            "message": error.message
          };
          msg.payload = null;
          send(msg);
          done();
        } else {
          const fs = require('fs');
          fs.readFile(outputFile, (err, data) => {
            if (err) {
              msg.error = {
                "code":error.code || null,
                "signal":error.signal || null,
                "message": error.message
              };
              msg.payload = null;
            } else {
              msg.error = null;
              msg.payload = data; // Binary image data
            }
            send(msg);
            done();
          });
        }
        child = null;
      });
    });
  }

  RED.nodes.registerType("webcam-capture", WebcamCaptureNode);
};