$("#videoUrlFormGroup").hide();

$('[name="mediaType"]').change(function() {
  if($("#imageTypeRadio").prop("checked")) {
    $("#videoUrlFormGroup").hide();
    $("#imageFileFormGroup").show();
  }
  else if($("#videoTypeRadio").prop("checked")) {
    $("#imageFileFormGroup").hide();
    $("#videoUrlFormGroup").show();
  }
});
